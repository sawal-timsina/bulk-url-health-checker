import { db } from "../client";
import { batches } from "../schema/batches";
import { urls } from "../schema/urls";

export interface CreateBatchInput {
  batchId: string;
  urls: Array<{
    id: string;
    url: string;
  }>;
}

export async function createBatchWithUrls(input: CreateBatchInput) {
  return db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(batches)
      .values({
        id: input.batchId,
        status: "pending",
        totalCount: input.urls.length,
        completedCount: 0,
      })
      .returning();

    if (input.urls.length > 0) {
      await tx.insert(urls).values(
        input.urls.map((item) => ({
          id: item.id,
          batchId: input.batchId,
          url: item.url,
          status: "queued" as const,
          attempts: 0,
        })),
      );
    }

    return batch;
  });
}
