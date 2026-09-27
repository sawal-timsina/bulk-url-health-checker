import { BATCH_LIST_CACHE_VERSION_KEY, type BatchEvent, batchEventsChannel } from "@bulk-url-checker/shared";
import { getRedis } from "./connection.js";

export async function publishBatchEvent(batchId: string, event: BatchEvent) {
  await getRedis().publish(batchEventsChannel(batchId), JSON.stringify(event));
}

export async function invalidateBatchListCache() {
  await getRedis().incr(BATCH_LIST_CACHE_VERSION_KEY);
}
