import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import { urls, type UrlStatus } from "../schema/urls.js";

interface SuccessInput {
  id: string;
  httpStatus: number;
  responseTimeMs: number;
  title: string | null;
}

export async function markUrlSuccess(input: SuccessInput) {
  const [url] = await db
    .update(urls)
    .set({
      status: "success",
      httpStatus: input.httpStatus,
      responseTimeMs: input.responseTimeMs,
      title: input.title,
      error: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(urls.id, input.id), eq(urls.status, "processing" as UrlStatus)))
    .returning();

  return url ?? null;
}

interface FailureInput {
  id: string;
  httpStatus?: number | null;
  responseTimeMs?: number | null;
  error: string;
}

export async function markUrlFailed(input: FailureInput) {
  const [url] = await db
    .update(urls)
    .set({
      status: "failed",
      httpStatus: input.httpStatus ?? null,
      responseTimeMs: input.responseTimeMs ?? null,
      error: input.error,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(urls.id, input.id), eq(urls.status, "processing" as UrlStatus)))
    .returning();

  return url ?? null;
}
