import { and, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { batches } from "../schema/batches.js";
import { urls } from "../schema/urls.js";

interface CompleteUrlInput {
  urlId: string;
  status: "success" | "failed";
  httpStatus?: number | null;
  responseTimeMs?: number | null;
  title?: string | null;
  error?: string | null;
}

export async function completeUrlAndUpdateBatch(input: CompleteUrlInput) {
  return db.transaction(async (tx) => {
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
      .where(and(eq(urls.id, input.urlId), eq(urls.status, "processing")))
      .returning();

    // Another worker/recovery process already completed this URL.
    if (!updatedUrl) {
      return null;
    }

    const [updatedBatch] = await tx
      .update(batches)
      .set({
        completedCount: sql`${batches.completedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(batches.id, updatedUrl.batchId))
      .returning();

    if (!updatedBatch) {
      throw new Error(`Batch ${updatedUrl.batchId} not found`);
    }

    const nextCompletedCount = updatedBatch.completedCount;

    if (nextCompletedCount >= updatedBatch.totalCount) {
      const [completedBatch] = await tx
        .update(batches)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(and(eq(batches.id, updatedBatch.id), eq(batches.status, "running")))
        .returning();

      return {
        url: updatedUrl,
        batch: completedBatch ?? updatedBatch,
      };
    }

    return {
      url: updatedUrl,
      batch: updatedBatch,
    };
  });
}
