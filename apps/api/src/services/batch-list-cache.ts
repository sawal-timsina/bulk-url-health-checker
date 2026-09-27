import { listBatches, toBatchSummary } from "@bulk-url-checker/db";
import { getRedis } from "@bulk-url-checker/queue";
import {
  BATCH_LIST_CACHE_TTL_SECONDS,
  BATCH_LIST_CACHE_VERSION_KEY,
  type BatchSummary,
  batchListCacheKey,
} from "@bulk-url-checker/shared";

export async function getBatchList(): Promise<{ batches: BatchSummary[]; cacheHit: boolean }> {
  const redis = getRedis();
  const version = (await redis.get(BATCH_LIST_CACHE_VERSION_KEY)) ?? "0";
  const key = batchListCacheKey(version);

  const cached = await redis.get(key);

  if (cached) {
    return { batches: JSON.parse(cached) as BatchSummary[], cacheHit: true };
  }

  const batches = (await listBatches()).map(toBatchSummary);

  await redis.set(key, JSON.stringify(batches), "EX", BATCH_LIST_CACHE_TTL_SECONDS);

  return { batches, cacheHit: false };
}
