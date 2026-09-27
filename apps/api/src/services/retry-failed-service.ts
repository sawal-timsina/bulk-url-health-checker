import { retryFailedUrls, toBatchSummary } from "@bulk-url-checker/db";
import { enqueueUrlChecks, invalidateBatchListCache } from "@bulk-url-checker/queue";
import type { RetryFailedResponse } from "@bulk-url-checker/shared";
import { batchNotFound, HttpError } from "../lib/errors.js";
import { publishSnapshot } from "./event-service.js";

export async function retryFailed(batchId: string): Promise<RetryFailedResponse> {
  const result = await retryFailedUrls(batchId);

  if (result.kind === "not_found") {
    throw batchNotFound();
  }

  if (result.kind === "cancelled") {
    throw new HttpError(409, "BATCH_CANCELLED", "Cancelled batches can't be retried");
  }

  if (result.retriedUrls.length > 0) {
    await enqueueUrlChecks(result.retriedUrls.map((url) => ({ batchId, urlId: url.id, generation: url.generation })));
    await invalidateBatchListCache();
    await publishSnapshot(batchId);
  }

  return { batch: toBatchSummary(result.batch), retriedCount: result.retriedUrls.length };
}
