import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { batches } from "../schema/batches.js";
import { urls } from "../schema/urls.js";

export async function cancelBatchAndUrls(batchId: string) {
  return db.transaction(async (tx) => {
    const [batch] = await tx
      .update(batches)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(and(eq(batches.id, batchId), sql`${batches.status} IN ('pending', 'running')`))
      .returning();

    if (!batch) {
      return null;
    }

    await tx
      .update(urls)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(urls.batchId, batchId), sql`${urls.status} IN ('queued', 'processing')`));

    return batch;
  });
}
