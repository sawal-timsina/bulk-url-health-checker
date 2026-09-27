import { cancelBatchAndUrls, findBatchById, toBatchSummary } from "@bulk-url-checker/db";
import { invalidateBatchListCache, removeUrlCheckJobs } from "@bulk-url-checker/queue";
import type { BatchSummary } from "@bulk-url-checker/shared";
import { batchNotFound, HttpError } from "../lib/errors.js";
import { publishSnapshot } from "./event-service.js";

export async function cancelBatch(batchId: string): Promise<BatchSummary> {
  const result = await cancelBatchAndUrls(batchId);

  if (!result) {
    const batch = await findBatchById(batchId);

    if (!batch) {
      throw batchNotFound();
    }

    throw new HttpError(409, "BATCH_NOT_ACTIVE", `Batch is already ${batch.status}`);
  }

  // Queued jobs are dropped so they don't use rate-limit slots; in-flight
  // ones finish but their results are discarded (the URL is "cancelled").
  await removeUrlCheckJobs(result.cancelledUrls.map((url) => ({ urlId: url.id, generation: url.generation })));
  await invalidateBatchListCache();
  await publishSnapshot(batchId);

  return toBatchSummary(result.batch);
}
