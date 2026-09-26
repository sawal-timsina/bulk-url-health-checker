import type { FastifyPluginAsync } from "fastify";
import { createBatchSchema } from "../../schemas/batch.js";
import { createBatch } from "../../services/batch-service.js";

interface CreateBatchBody {
  urls: string[];
}

export const createBatchRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CreateBatchBody }>(
    "/",
    {
      schema: createBatchSchema,
    },
    async (request, reply) => {
      const batch = await createBatch(request.body);

      return reply.code(202).send({
        batch,
      });
    },
  );
};
