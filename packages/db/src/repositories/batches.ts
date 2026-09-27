import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../client.js";
import { batches } from "../schema/batches.js";

export async function findBatchById(id: string) {
  const [batch] = await getDb().select().from(batches).where(eq(batches.id, id)).limit(1);

  return batch ?? null;
}

export async function listBatches() {
  return getDb().select().from(batches).orderBy(desc(batches.createdAt));
}

/**
 * pending → running. Returns null when the batch was already past pending,
 * so callers can tell whether the status actually changed.
 */
export async function markBatchRunning(id: string) {
  const [batch] = await getDb()
    .update(batches)
    .set({
      status: "running",
      updatedAt: new Date(),
    })
    .where(and(eq(batches.id, id), eq(batches.status, "pending")))
    .returning();

  return batch ?? null;
}

export async function incrementBatchCompletedCount(id: string) {
  const [batch] = await db
    .update(batches)
    .set({
      completedCount: sql`${batches.completedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(batches.id, id))
    .returning();

  return batch ?? null;
}

export async function cancelBatch(id: string) {
  const [batch] = await db
    .update(batches)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(and(eq(batches.id, id), sql`${batches.status} IN ('pending', 'running')`))
    .returning();

  return batch ?? null;
}
