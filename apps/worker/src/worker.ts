import { Worker } from "bullmq";
import {
  claimUrlForProcessing,
  completeUrlAndUpdateBatch,
  findProcessingUrl,
  markBatchRunning,
} from "@bulk-url-checker/db";
import type { UrlCheckJob } from "@bulk-url-checker/shared";
import { configureUrlCheckQueue, createRedisConnection, URL_CHECK_QUEUE } from "@bulk-url-checker/queue";
import { checkUrl } from "./services/url-checker.js";
import { isTransientHttpStatus, isTransientNetworkError } from "./services/errors.js";
import { TransientHttpError } from "./services/http-errors.js";

const connection = createRedisConnection();

export const urlCheckWorker = new Worker<UrlCheckJob>(
  URL_CHECK_QUEUE,

  async (job) => {
    const { urlId, batchId } = job.data;

    /*
     * First attempt:
     *
     * queued → processing
     */
    if (job.attemptsMade === 0) {
      const claimedUrl = await claimUrlForProcessing(urlId);

      if (!claimedUrl) {
        console.log(`Skipping ${urlId}: URL is no longer queued`);

        return {
          urlId,
          skipped: true,
        };
      }

      await markBatchRunning(batchId);
    }

    /*
     * Retry:
     * processing → processing
     */
    const url = await findProcessingUrl(urlId);

    if (!url) {
      console.log(`Skipping ${urlId}: no processing URL found`);

      return {
        urlId,
        skipped: true,
      };
    }

    console.log(`Checking ${url.url} ` + `(attempt ${job.attemptsMade + 1})`);

    try {
      const result = await checkUrl(url.url);

      /*
       * HTTP response received, but the status is
       * considered transient.
       */
      if (isTransientHttpStatus(result.httpStatus)) {
        throw new TransientHttpError(
          `Transient HTTP status: ${result.httpStatus}`,
          result.httpStatus,
          result.responseTimeMs,
          result.title,
        );
      }

      /*
       * Any HTTP response that isn't classified as
       * transient is a completed health check.
       *
       * 2xx → success
       * 3xx → success
       * 4xx → failed
       */
      const status = result.httpStatus >= 200 && result.httpStatus < 400 ? "success" : "failed";

      const completion = await completeUrlAndUpdateBatch({
        urlId,
        status,
        httpStatus: result.httpStatus,
        responseTimeMs: result.responseTimeMs,
        title: result.title,
        error: status === "failed" ? `HTTP ${result.httpStatus}` : null,
      });

      if (!completion) {
        console.log(`URL ${urlId} was no longer processing; ignoring result`);

        return {
          urlId,
          skipped: true,
        };
      }

      console.log(`Completed ${url.url}: ` + `${result.httpStatus} ` + `(${result.responseTimeMs}ms)`);

      return {
        urlId,
        status,
      };
    } catch (error) {
      const totalAttempts = job.opts.attempts ?? 1;

      const currentAttempt = job.attemptsMade + 1;

      const isLastAttempt = currentAttempt >= totalAttempts;

      if (error instanceof TransientHttpError && isLastAttempt) {
        const completion = await completeUrlAndUpdateBatch({
          urlId,
          status: "failed",
          httpStatus: error.httpStatus,
          responseTimeMs: error.responseTimeMs,
          title: error.title,
          error: `HTTP ${error.httpStatus} ` + `after ${currentAttempt} attempts`,
        });
        if (!completion) {
          console.log(`URL ${urlId} was no longer processing; ignoring result`);

          return {
            urlId,
            skipped: true,
          };
        }

        return {
          urlId,
          status: "failed",
        };
      }

      /*
       * Network / timeout failure.
       */
      if (isTransientNetworkError(error)) {
        if (isLastAttempt) {
          const completion = await completeUrlAndUpdateBatch({
            urlId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown network error",
          });

          if (!completion) {
            console.log(`URL ${urlId} was no longer processing; ignoring result`);

            return {
              urlId,
              skipped: true,
            };
          }

          return {
            urlId,
            status: "failed",
          };
        }

        /*
         * Leave DB status as "processing".
         * BullMQ will retry the same job.
         */
        throw error instanceof Error ? error : new Error("Unknown network error");
      }

      throw error;
    }
  },

  {
    connection,
    concurrency: 5,
  },
);

export async function startWorker() {
  await configureUrlCheckQueue();

  console.log("URL check queue configured: " + "global concurrency=5, global rate=10/sec");
}
