import type { BatchDetails, BatchSummary, UrlCheckResult } from "@bulk-url-checker/shared";
import type { Batch } from "./schema/batches.js";
import type { Url } from "./schema/urls.js";

export function toBatchSummary(batch: Batch): BatchSummary {
  return {
    id: batch.id,
    status: batch.status,
    totalCount: batch.totalCount,
    completedCount: batch.completedCount,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  };
}

export function toUrlCheckResult(url: Url): UrlCheckResult {
  return {
    id: url.id,
    batchId: url.batchId,
    url: url.url,
    status: url.status,
    httpStatus: url.httpStatus,
    responseTimeMs: url.responseTimeMs,
    title: url.title,
    error: url.error,
    attempts: url.attempts,
    createdAt: url.createdAt.toISOString(),
    startedAt: url.startedAt?.toISOString() ?? null,
    completedAt: url.completedAt?.toISOString() ?? null,
    updatedAt: url.updatedAt.toISOString(),
  };
}

export function toBatchDetails(batch: Batch, urls: Url[]): BatchDetails {
  return {
    ...toBatchSummary(batch),
    urls: urls.map(toUrlCheckResult),
  };
}
