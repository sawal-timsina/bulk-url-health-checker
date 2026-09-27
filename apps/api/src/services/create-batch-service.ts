import { randomUUID } from "node:crypto";
import { createBatchWithUrls, toBatchSummary } from "@bulk-url-checker/db";
import { enqueueUrlChecks, invalidateBatchListCache } from "@bulk-url-checker/queue";
import type { BatchSummary } from "@bulk-url-checker/shared";
import { validateUrls } from "../validators/url-validator.js";
import { reserveBatchId } from "./idempotency-service.js";

export async function createBatch(
  urls: string[],
  idempotencyKey?: string,
): Promise<{ batch: BatchSummary; created: boolean }> {
  const uniqueUrls = validateUrls(urls);
  const { batchId, existing, release } = await reserveBatchId(idempotencyKey);

  if (existing) {
    return { batch: toBatchSummary(existing), created: false };
  }

  const urlRecords = uniqueUrls.map((url) => ({ id: randomUUID(), url }));

  let batch;

  try {
    // Persisted before any job exists, so a worker never sees an unknown URL.
    batch = await createBatchWithUrls({ batchId, urls: urlRecords });
  } catch (error) {
    await release();
    throw error;
  }

  /*
   * If this fails after the commit, the URLs stay "queued" in Postgres and
   * the worker's startup reconciler enqueues them.
   */
  await enqueueUrlChecks(urlRecords.map((url) => ({ batchId, urlId: url.id, generation: 0 })));
  await invalidateBatchListCache();

  return { batch: toBatchSummary(batch), created: true };
}
