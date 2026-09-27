import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../client.js";
import { urls } from "../schema/urls.js";

/**
 * queued → processing, or processing → processing for a retry / a job
 * re-run after a worker crash. Counts every attempt.
 *
 * Returns null when the URL was cancelled, already finished, or belongs to a
 * newer generation (a stale job from before "retry failed").
 */
export async function claimUrlForProcessing(id: string, generation: number) {
  const [url] = await getDb()
    .update(urls)
    .set({
      status: "processing",
      attempts: sql`${urls.attempts} + 1`,
      startedAt: sql`COALESCE(${urls.startedAt}, now())`,
      updatedAt: new Date(),
    })
    .where(and(eq(urls.id, id), eq(urls.generation, generation), inArray(urls.status, ["queued", "processing"])))
    .returning();

  return url ?? null;
}
