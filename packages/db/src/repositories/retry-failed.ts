import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../client.js";
import { Batch, batches } from "../schema/batches.js";
import { urls } from "../schema/urls.js";

export type RetryFailedResult =
  | { kind: "not_found" }
  | { kind: "cancelled" }
  | {
      kind: "ok";
      batch: Batch;
      retriedUrls: Array<{ id: string; generation: number }>;
    };

/**
 * failed → queued for every failed URL in the batch, leaving successful URLs
 * untouched. Bumps each URL's generation so it gets a fresh BullMQ jobId.
 *
 * Idempotent: a second call finds no failed URLs and changes nothing.
 */
export async function retryFailedUrls(batchId: string): Promise<RetryFailedResult> {
  return getDb().transaction(async (tx) => {
    const [batch] = await tx.select().from(batches).where(eq(batches.id, batchId)).for("update");

    if (!batch) {
      return { kind: "not_found" };
    }

    if (batch.status === "cancelled") {
      return { kind: "cancelled" };
    }

    const retriedUrls = await tx
      .update(urls)
      .set({
        status: "queued",
        generation: sql`${urls.generation} + 1`,
        attempts: 0,
        httpStatus: null,
        responseTimeMs: null,
        title: null,
        error: null,
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(urls.batchId, batchId), eq(urls.status, "failed")))
      .returning({ id: urls.id, generation: urls.generation });

    if (retriedUrls.length === 0) {
      return { kind: "ok", batch, retriedUrls };
    }

    const [updatedBatch] = await tx
      .update(batches)
      .set({
        status: "running",
        completedCount: sql`${batches.completedCount} - ${retriedUrls.length}`,
        updatedAt: new Date(),
      })
      .where(eq(batches.id, batchId))
      .returning();

    return { kind: "ok", batch: updatedBatch!, retriedUrls };
  });
}
