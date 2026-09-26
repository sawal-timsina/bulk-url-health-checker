import type { FastifyPluginAsync } from "fastify";

import { findBatchById, findUrlsByBatchId } from "@bulk-url-checker/db";

interface BatchParams {
  id: string;
}

export const getBatchRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Params: BatchParams }>("/:id", async (request, reply) => {
    const { id } = request.params;

    const batch = await findBatchById(id);

    if (!batch) {
      return reply.code(404).send({
        error: "BATCH_NOT_FOUND",
        message: "Batch not found",
      });
    }

    const urls = await findUrlsByBatchId(id);

    return {
      batch: {
        id: batch.id,
        status: batch.status,
        totalCount: batch.totalCount,
        completedCount: batch.completedCount,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString(),

        urls: urls.map((url) => ({
          id: url.id,
          batchId: url.batchId,
          url: url.url,
          status: url.status,
          httpStatus: url.httpStatus,
          responseTimeMs: url.responseTimeMs,
          title: url.title,
          error: url.error,
          attempts: url.attempts,
          createdAt: url.createdAt.toISOString(),
          startedAt: url.startedAt?.toISOString() ?? null,
          completedAt: url.completedAt?.toISOString() ?? null,
        })),
      },
    };
  });
};
