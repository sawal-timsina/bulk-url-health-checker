import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { batches, type BatchStatus, type NewBatch } from "../schema/batches.js";

export async function createBatch(data: NewBatch) {
  const [batch] = await db.insert(batches).values(data).returning();

  return batch;
}

export async function findBatchById(id: string) {
  const [batch] = await db.select().from(batches).where(eq(batches.id, id)).limit(1);

  return batch ?? null;
}

export async function listBatches() {
  return db.select().from(batches).orderBy(desc(batches.createdAt));
}

export async function markBatchRunning(id: string) {
  const [batch] = await db
    .update(batches)
    .set({
      status: "running" as BatchStatus,
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
