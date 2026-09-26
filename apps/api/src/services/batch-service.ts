import { createBatchWithUrls } from "@bulk-url-checker/db";
import type { BatchSummary } from "@bulk-url-checker/shared";
import { randomUUID } from "node:crypto";
import { normalizeUrl } from "../utils/url.js";

interface Args {
  urls: string[];
}

export async function createBatch(input: Args): Promise<BatchSummary> {
  const batchId = randomUUID();

  const urlRecords = input.urls.map((url) => ({
    id: randomUUID(),
    url: normalizeUrl(url),
  }));

  const batch = await createBatchWithUrls({
    batchId,
    urls: urlRecords,
  });

  return {
    id: batch!.id,
    status: batch!.status,
    totalCount: batch!.totalCount,
    completedCount: batch!.completedCount,
    createdAt: batch!.createdAt.toISOString(),
    updatedAt: batch!.updatedAt.toISOString(),
  };
}
