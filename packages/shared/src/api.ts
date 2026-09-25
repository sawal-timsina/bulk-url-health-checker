import type { BatchStatus, UrlCheckStatus } from "./index.js";

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

export interface ApiError {
  error: string;
  message: string;
}
