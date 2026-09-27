import type { Job } from "bullmq";
import type { UrlCheckJob } from "@bulk-url-checker/shared";
import { isTransientNetworkError } from "../checks/transient.js";
import { TransientHttpError } from "../checks/transient-http-error.js";

export function isRetryable(error: unknown): boolean {
  return error instanceof TransientHttpError || isTransientNetworkError(error);
}

export function isFinalAttempt(job: Job<UrlCheckJob>): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

export function hasExhaustedAttempts(job: Job<UrlCheckJob>): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}
