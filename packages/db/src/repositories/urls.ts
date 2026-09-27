import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "../client.js";
import { batches } from "../schema/batches.js";
import { urls } from "../schema/urls.js";

export async function findUrlsByBatchId(batchId: string) {
  return getDb().select().from(urls).where(eq(urls.batchId, batchId)).orderBy(asc(urls.createdAt), asc(urls.url));
}

/**
 * URLs that should have a live job: not finished, in a batch that is still active.
 * Used by the worker on startup to re-enqueue anything whose enqueue was lost.
 */
export async function findUnfinishedUrls() {
  return getDb()
    .select({
      id: urls.id,
      batchId: urls.batchId,
      generation: urls.generation,
    })
    .from(urls)
    .innerJoin(batches, eq(batches.id, urls.batchId))
    .where(and(inArray(urls.status, ["queued", "processing"]), inArray(batches.status, ["pending", "running"])));
}
