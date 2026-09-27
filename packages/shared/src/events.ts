import type { BatchDetails, BatchSummary, UrlCheckResult } from "./api.ts";

export type BatchEvent =
  { type: "snapshot"; batch: BatchDetails } | { type: "url.updated"; url: UrlCheckResult; batch: BatchSummary };

export function batchEventsChannel(batchId: string): string {
  return `batch-events:${batchId}`;
}

export const BATCH_LIST_CACHE_VERSION_KEY = "cache:batches:list:version";
export const BATCH_LIST_CACHE_TTL_SECONDS = 30;

export function batchListCacheKey(version: string | number): string {
  return `cache:batches:list:v${version}`;
}

export const TERMINAL_BATCH_STATUSES = ["completed", "cancelled"] as const;
