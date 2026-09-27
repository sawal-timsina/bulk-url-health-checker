import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../client.js";
import { batches } from "../schema/batches.js";
import { urls } from "../schema/urls.js";

/**
 * Cancels an active batch and every URL that hasn't finished yet.
 *
 * In-flight checks are not interrupted, but completeUrlAndUpdateBatch only
 * writes to URLs still in "processing", so their results are discarded.
 *
 * Returns null when the batch doesn't exist or is already completed/cancelled.
 */
export async function cancelBatchAndUrls(batchId: string) {
  return getDb().transaction(async (tx) => {
    const [batch] = await tx
      .update(batches)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(and(eq(batches.id, batchId), inArray(batches.status, ["pending", "running"])))
      .returning();

    if (!batch) {
      return null;
    }

    const cancelledUrls = await tx
      .update(urls)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(urls.batchId, batchId), inArray(urls.status, ["queued", "processing"])))
      .returning({ id: urls.id, generation: urls.generation });

    return { batch, cancelledUrls };
  });
}
