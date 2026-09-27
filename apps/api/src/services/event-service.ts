import { findBatchById, findUrlsByBatchId, toBatchDetails } from "@bulk-url-checker/db";
import { publishBatchEvent } from "@bulk-url-checker/queue";

export async function publishSnapshot(batchId: string) {
  const [batch, urls] = await Promise.all([findBatchById(batchId), findUrlsByBatchId(batchId)]);

  if (batch) {
    await publishBatchEvent(batchId, { type: "snapshot", batch: toBatchDetails(batch, urls) });
  }
}
