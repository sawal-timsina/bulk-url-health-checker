import { db } from "../client.js";
import { type Batch, batches } from "../schema/batches.js";
import { urls } from "../schema/urls.js";

export interface CreateBatchInput {
  batchId: string;
  urls: Array<{
    id: string;
    url: string;
  }>;
}

export async function createBatchWithUrls(input: CreateBatchInput) {
  return db.transaction<Batch>(async (tx) => {
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
