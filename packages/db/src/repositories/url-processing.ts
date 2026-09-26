import { and, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { urls, UrlStatus } from "../schema/urls.js";

export async function claimUrlForProcessing(id: string) {
  const [url] = await db
    .update(urls)
    .set({
      status: "processing",
      attempts: sql`${urls.attempts} + 1`,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(urls.id, id), eq(urls.status, "queued" as UrlStatus)))
    .returning();

  return url ?? null;
}

export async function findProcessingUrl(id: string) {
  const [url] = await db
    .select()
    .from(urls)
    .where(and(eq(urls.id, id), eq(urls.status, "processing" as UrlStatus)))
    .limit(1);

  return url ?? null;
}
