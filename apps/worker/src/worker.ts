import { Worker } from "bullmq";
import { configureUrlCheckQueue, createRedisConnection, URL_CHECK_QUEUE } from "@bulk-url-checker/queue";
import { claimUrlForProcessing, markBatchRunning, markUrlFailed, markUrlSuccess } from "@bulk-url-checker/db";
import type { UrlCheckJob } from "@bulk-url-checker/shared";
import { checkUrl } from "./services/url-checker.js";
import { isTransientHttpStatus, isTransientNetworkError } from "./services/errors.js";

const connection = createRedisConnection();

export const urlCheckWorker = new Worker<UrlCheckJob>(
  URL_CHECK_QUEUE,
  async (job) => {
    const { urlId, batchId } = job.data;

    const claimedUrl = await claimUrlForProcessing(urlId);

    if (!claimedUrl) {
      console.log(`Skipping URL ${urlId}: it is no longer queued`);

      return {
        urlId,
        skipped: true,
      };
    }

    await markBatchRunning(batchId);

    console.log(`Checking ${claimedUrl.url} (attempt ${claimedUrl.attempts})`);

    try {
      const result = await checkUrl(claimedUrl.url);

      if (isTransientHttpStatus(result.httpStatus)) {
        throw new Error(`Transient HTTP status: ${result.httpStatus}`);
      }

      await markUrlSuccess({
        id: urlId,
        httpStatus: result.httpStatus,
        responseTimeMs: result.responseTimeMs,
        title: result.title,
      });

      console.log(`Completed ${claimedUrl.url}: ${result.httpStatus} (${result.responseTimeMs}ms)`);

      return {
        urlId,
        status: "success",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown URL check error";

      const transient = isTransientNetworkError(error);

      if (transient) {
        console.log(`Transient failure for ${claimedUrl.url}: ${message}`);

        throw error instanceof Error ? error : new Error(message);
      }

      await markUrlFailed({
        id: urlId,
        error: message,
      });

      return {
        urlId,
        status: "failed",
      };
    }
  },

  {
    connection,
    // Local safety limit.
    // The queue-level global limit is the real system-wide limit.
    concurrency: 5,
  },
);

export async function startWorker() {
  await configureUrlCheckQueue();

  console.log("URL check queue configured: concurrency=5, rate=10/sec");
}
