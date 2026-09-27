import { type Job, Worker } from "bullmq";
import {
  configureUrlCheckQueue,
  createRedisConnection,
  GLOBAL_CONCURRENCY,
  OUTBOUND_RATE_LIMIT,
  URL_CHECK_QUEUE,
} from "@bulk-url-checker/queue";
import type { UrlCheckJob } from "@bulk-url-checker/shared";
import { type JobResult, outcomeFromInternalError } from "../jobs/outcome.js";
import { processUrlCheck } from "../jobs/process-url-check.js";
import { hasExhaustedAttempts } from "../jobs/retry-policy.js";
import { completeUrl } from "../state/url-lifecycle.js";

export type UrlCheckWorker = Worker<UrlCheckJob, JobResult>;

async function failExhaustedJob(job: Job<UrlCheckJob> | undefined, error: Error) {
  if (!job || !hasExhaustedAttempts(job)) {
    return;
  }

  try {
    await completeUrl(job.data, outcomeFromInternalError(error));
  } catch (completeError) {
    console.error(`Could not mark URL ${job.data.urlId} as failed`, completeError);
  }
}

export function createUrlCheckWorker(): UrlCheckWorker {
  const worker = new Worker<UrlCheckJob, JobResult>(URL_CHECK_QUEUE, processUrlCheck, {
    connection: createRedisConnection(),
    // Per-process cap; the global cap across all workers is enforced on the queue in Redis.
    concurrency: GLOBAL_CONCURRENCY,
    autorun: false,
  });

  worker.on("failed", (job, error) => void failExhaustedJob(job, error));

  return worker;
}

export async function startUrlCheckWorker(worker: UrlCheckWorker) {
  await configureUrlCheckQueue();

  console.log(
    `URL check queue configured: global concurrency=${GLOBAL_CONCURRENCY}, ` +
      `rate=${OUTBOUND_RATE_LIMIT.max} per ${OUTBOUND_RATE_LIMIT.windowMs}ms (sliding, all workers)`,
  );

  void worker.run();
}
