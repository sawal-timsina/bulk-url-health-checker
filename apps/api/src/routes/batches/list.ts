import type { FastifyPluginAsync } from "fastify";

import { listBatches } from "@bulk-url-checker/db";

export const listBatchRoute: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    const batches = await listBatches();

    return {
      batches: batches.map((batch) => ({
        id: batch.id,
        status: batch.status,
        totalCount: batch.totalCount,
        completedCount: batch.completedCount,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString(),
      })),
    };
  });
};
