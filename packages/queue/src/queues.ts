import { Queue } from "bullmq";
import { type UrlCheckJob, urlCheckJobId } from "@bulk-url-checker/shared";
import { createRedisConnection } from "./connection.js";

export const URL_CHECK_QUEUE = "url-checks";

let urlCheckQueue: Queue<UrlCheckJob> | undefined;

export function getUrlCheckQueue(): Queue<UrlCheckJob> {
  urlCheckQueue ??= new Queue<UrlCheckJob>(URL_CHECK_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      // Initial attempt + 3 retries.
      attempts: 4,

      // 1s, 2s, 4s between attempts.
      backoff: {
        type: "exponential",
        delay: 1000,
      },

      // Keep a small history for debugging.
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  });

  return urlCheckQueue;
}

/**
 * Enqueues one job per URL. The jobId is deterministic, so enqueueing the
 * same URL generation twice (a client retry, the startup reconciler) is a no-op.
 */
export async function enqueueUrlChecks(jobs: UrlCheckJob[]) {
  if (jobs.length === 0) {
    return;
  }

  await getUrlCheckQueue().addBulk(
    jobs.map((job) => ({
      name: "check-url",
      data: job,
      opts: { jobId: urlCheckJobId(job.urlId, job.generation) },
    })),
  );
}

/**
 * Best-effort removal of jobs that haven't started, so cancelled URLs don't
 * use rate-limit slots. Jobs that are active (locked) can't be removed; the
 * worker discards their results because the URL is no longer "processing".
 */
export async function removeUrlCheckJobs(jobs: Array<{ urlId: string; generation: number }>) {
  const queue = getUrlCheckQueue();

  await Promise.all(
    jobs.map(async ({ urlId, generation }) => {
      try {
        await queue.remove(urlCheckJobId(urlId, generation));
      } catch {
        // Active job: its lock prevents removal.
      }
    }),
  );
}
