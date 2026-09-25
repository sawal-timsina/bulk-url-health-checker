import { desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { batches, type NewBatch } from "../schema/batches.js";

export async function createBatch(data: NewBatch) {
  const [batch] = await db.insert(batches).values(data).returning();

  return batch;
}

export async function findBatchById(id: string) {
  const [batch] = await db
    .select()
    .from(batches)
    .where(eq(batches.id, id))
    .limit(1);

  return batch ?? null;
}

export async function listBatches() {
  return db.select().from(batches).orderBy(desc(batches.createdAt));
}
