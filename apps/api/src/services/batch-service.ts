import { randomUUID } from "node:crypto";
import { createBatchWithUrls } from "@bulk-url-checker/db";
import type { BatchSummary } from "@bulk-url-checker/shared";
import { enqueueUrlCheck } from "./queue-service.js";
import { normalizeUrl } from "../utils/url.js";

interface Args {
  urls: string[];
}

export async function createBatch(input: Args): Promise<BatchSummary> {
  const normalizedUrls = input.urls.map(normalizeUrl);

  const batchId = randomUUID();

  const urlRecords = normalizedUrls.map((url) => ({
    id: randomUUID(),
    url,
  }));

  const batch = await createBatchWithUrls({
    batchId,
    urls: urlRecords,
  });

  await Promise.all(
    urlRecords.map((url) =>
      enqueueUrlCheck({
        batchId,
        urlId: url.id,
      }),
    ),
  );

  return {
    id: batch.id,
    status: batch.status,
    totalCount: batch.totalCount,
    completedCount: batch.completedCount,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  };
}
