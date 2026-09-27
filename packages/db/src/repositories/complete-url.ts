import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../client.js";
import { batches } from "../schema/batches.js";
import { urls } from "../schema/urls.js";

interface CompleteUrlInput {
  urlId: string;
  generation: number;
  status: "success" | "failed";
  httpStatus?: number | null;
  responseTimeMs?: number | null;
  title?: string | null;
  error?: string | null;
}

/**
 * processing → success|failed, and bumps the batch's completed count in the
 * same transaction. Marks the batch completed when it was the last URL.
 *
 * Returns null when the URL is no longer processing (cancelled, completed by
 * another attempt, or reset by "retry failed"), so the result is discarded.
 */
export async function completeUrlAndUpdateBatch(input: CompleteUrlInput) {
  return getDb().transaction(async (tx) => {
    const [updatedUrl] = await tx
      .update(urls)
      .set({
        status: input.status,
        httpStatus: input.httpStatus ?? null,
        responseTimeMs: input.responseTimeMs ?? null,
        title: input.title ?? null,
        error: input.error ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(urls.id, input.urlId), eq(urls.generation, input.generation), eq(urls.status, "processing")))
      .returning();

    if (!updatedUrl) {
      return null;
    }

    const [updatedBatch] = await tx
      .update(batches)
      .set({
        completedCount: sql`${batches.completedCount} + 1`,
        status: sql`CASE
          WHEN ${batches.completedCount} + 1 >= ${batches.totalCount} AND ${batches.status} = 'running'
          THEN 'completed'::batch_status
          ELSE ${batches.status}
        END`,
        updatedAt: new Date(),
      })
      .where(eq(batches.id, updatedUrl.batchId))
      .returning();

    if (!updatedBatch) {
      throw new Error(`Batch ${updatedUrl.batchId} not found`);
    }

    return {
      url: updatedUrl,
      batch: updatedBatch,
      batchCompleted: updatedBatch.status === "completed" && updatedBatch.completedCount === updatedBatch.totalCount,
    };
  });
}
