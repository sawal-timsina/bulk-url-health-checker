import type { FastifyPluginCallback } from "fastify";
import type { CreateBatchRequest, CreateBatchResponse } from "@bulk-url-checker/shared";
import { createBatchSchema } from "../../schemas/batch.js";
import { createBatch } from "../../services/create-batch-service.js";

export const createBatchRoute: FastifyPluginCallback = (app, _options, done) => {
  app.post<{
    Body: CreateBatchRequest;
    Headers: { "idempotency-key"?: string };
    Reply: CreateBatchResponse;
  }>("/", { schema: createBatchSchema }, async (request, reply) => {
    const { batch, created } = await createBatch(request.body.urls, request.headers["idempotency-key"]);

    // 202: accepted for background processing; 200 when replaying an idempotent request.
    return reply.code(created ? 202 : 200).send({ batch });
  });

  done();
};
