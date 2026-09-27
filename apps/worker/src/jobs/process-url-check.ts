import type { Job } from "bullmq";
import { acquireRateLimitSlot, OUTBOUND_RATE_LIMIT } from "@bulk-url-checker/queue";
import type { UrlCheckJob } from "@bulk-url-checker/shared";
import { checkUrl } from "../checks/check-url.js";
import { describeError, transientErrorFor } from "../checks/transient.js";
import { claimUrl, completeUrl } from "../state/url-lifecycle.js";
import { type JobResult, outcomeFromFailure, outcomeFromResponse, type UrlOutcome } from "./outcome.js";
import { isFinalAttempt, isRetryable } from "./retry-policy.js";

export async function processUrlCheck(job: Job<UrlCheckJob>): Promise<JobResult> {
  const url = await claimUrl(job.data);

  if (!url) {
    console.log(`Skipping ${job.data.urlId}: cancelled, finished, or superseded`);

    return { urlId: job.data.urlId, skipped: true };
  }

  const attempt = job.attemptsMade + 1;
  let outcome: UrlOutcome;

  console.log(`Checking ${url.url} (attempt ${attempt})`);

  /*
   * Only the check itself is inside try: a database error while persisting
   * must reach BullMQ as a retry, not be recorded as the URL failing.
   */
  try {
    // System-wide 10 req/s, shared by every worker process (and every retry).
    await acquireRateLimitSlot(OUTBOUND_RATE_LIMIT);

    const result = await checkUrl(url.url);
    const transientError = transientErrorFor(result);

    if (transientError) {
      throw transientError;
    }

    console.log(`Completed ${url.url}: ${result.httpStatus} (${result.responseTimeMs}ms)`);

    outcome = outcomeFromResponse(result);
  } catch (error) {
    if (isRetryable(error) && !isFinalAttempt(job)) {
      throw error;
    }

    console.log(`Failed ${url.url}: ${describeError(error)}`);

    outcome = outcomeFromFailure(error, attempt);
  }

  return completeUrl(job.data, outcome);
}
