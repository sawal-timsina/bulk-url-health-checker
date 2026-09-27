import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "../client.js";
import { batches } from "../schema/batches.js";
import { urls } from "../schema/urls.js";

export async function findUrlsByBatchId(batchId: string) {
  return getDb().select().from(urls).where(eq(urls.batchId, batchId)).orderBy(asc(urls.createdAt), asc(urls.url));
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
