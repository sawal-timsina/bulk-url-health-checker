import { findUnfinishedUrls } from "@bulk-url-checker/db";
import { enqueueUrlChecks, getUrlCheckQueue } from "@bulk-url-checker/queue";
import { urlCheckJobId } from "@bulk-url-checker/shared";

/**
 * Makes sure every unfinished URL in an active batch has a live job.
 *
 * Covers the gap between the API's DB commit and its enqueue (API crashed,
 * Redis blipped) and jobs that ended without finishing their URL. Safe to run
 * from several workers at once: jobIds are deterministic, so adds deduplicate.
 */
export async function reconcileUnfinishedUrls() {
  const queue = getUrlCheckQueue();
  const unfinished = await findUnfinishedUrls();

  const missing = [];

  for (const url of unfinished) {
    const job = await queue.getJob(urlCheckJobId(url.id, url.generation));

    if (job) {
      const state = await job.getState();

      if (state !== "completed" && state !== "failed") {
        continue;
      }

      // The job ended but the URL never finished: replace it.
      await job.remove();
    }

    missing.push({ batchId: url.batchId, urlId: url.id, generation: url.generation });
  }

  await enqueueUrlChecks(missing);

  return { checked: unfinished.length, enqueued: missing.length };
}
