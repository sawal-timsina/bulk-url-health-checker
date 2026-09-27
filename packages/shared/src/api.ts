import type { BatchStatus } from "./batch.ts";
import type { UrlCheckStatus } from "./url-check.ts";

export interface BatchSummary {
  id: string;
  status: BatchStatus;
  totalCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UrlCheckResult {
  id: string;
  batchId: string;
  url: string;
  status: UrlCheckStatus;

  httpStatus: number | null;
  responseTimeMs: number | null;
  title: string | null;
  error: string | null;

  attempts: number;

  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface BatchDetails extends BatchSummary {
  urls: UrlCheckResult[];
}

export interface CreateBatchRequest {
  urls: string[];
}

export interface CreateBatchResponse {
  batch: BatchSummary;
}

export interface ListBatchesResponse {
  batches: BatchSummary[];
}

export interface GetBatchResponse {
  batch: BatchDetails;
}

export interface BatchActionResponse {
  batch: BatchSummary;
}

export interface RetryFailedResponse extends BatchActionResponse {
  retriedCount: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
