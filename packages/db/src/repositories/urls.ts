import { eq } from "drizzle-orm";

import { db } from "../client.js";
import { type NewUrl, urls } from "../schema/urls.js";

export async function createUrls(data: NewUrl[]) {
  if (data.length === 0) {
    return [];
  }

  return db.insert(urls).values(data).returning();
}

export async function findUrlsByBatchId(batchId: string) {
  return db.select().from(urls).where(eq(urls.batchId, batchId));
}

export async function findUrlById(id: string) {
  const [url] = await db.select().from(urls).where(eq(urls.id, id)).limit(1);

  return url ?? null;
}

export async function markUrlProcessing(id: string) {
  const [url] = await db
    .update(urls)
    .set({
      status: "processing",
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(urls.id, id))
    .returning();

  return url ?? null;
}
