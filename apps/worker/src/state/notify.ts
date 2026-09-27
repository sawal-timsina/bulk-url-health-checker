import type { BatchEvent } from "@bulk-url-checker/shared";
import { invalidateBatchListCache, publishBatchEvent } from "@bulk-url-checker/queue";

export async function notifyBatch(batchId: string, event: BatchEvent, batchStatusChanged: boolean) {
  try {
    if (batchStatusChanged) {
      await invalidateBatchListCache();
    }

    await publishBatchEvent(batchId, event);
  } catch (error) {
    console.error(`Failed to publish event for batch ${batchId}`, error);
  }
}
