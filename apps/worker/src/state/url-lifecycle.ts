import {
  claimUrlForProcessing,
  completeUrlAndUpdateBatch,
  findBatchById,
  markBatchRunning,
  toBatchSummary,
  toUrlCheckResult,
} from "@bulk-url-checker/db";
import type { UrlCheckJob } from "@bulk-url-checker/shared";
import type { JobResult, UrlOutcome } from "../jobs/outcome.js";
import { notifyBatch } from "./notify.js";

export async function claimUrl({ urlId, batchId, generation }: UrlCheckJob) {
  const url = await claimUrlForProcessing(urlId, generation);

  if (!url) {
    return null;
  }

  const startedBatch = await markBatchRunning(batchId);
  const batch = startedBatch ?? (await findBatchById(batchId));

  if (batch) {
    await notifyBatch(
      batchId,
      { type: "url.updated", url: toUrlCheckResult(url), batch: toBatchSummary(batch) },
      startedBatch !== null,
    );
  }

  return url;
}

export async function completeUrl(
  { urlId, batchId, generation }: UrlCheckJob,
  outcome: UrlOutcome,
): Promise<JobResult> {
  const completion = await completeUrlAndUpdateBatch({ urlId, generation, ...outcome });

  if (!completion) {
    console.log(`URL ${urlId} is no longer processing; discarding result`);

    return { urlId, skipped: true };
  }

  await notifyBatch(
    batchId,
    { type: "url.updated", url: toUrlCheckResult(completion.url), batch: toBatchSummary(completion.batch) },
    completion.batchCompleted,
  );

  return { urlId, status: outcome.status };
}
