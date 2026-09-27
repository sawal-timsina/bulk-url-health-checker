import type { FastifyPluginCallback } from "fastify";
import type { ListBatchesResponse } from "@bulk-url-checker/shared";
import { getBatchList } from "../../services/batch-list-cache.js";

export const listBatchRoute: FastifyPluginCallback = (app, _options, done) => {
  app.get<{ Reply: ListBatchesResponse }>("/", async (_request, reply) => {
    const { batches, cacheHit } = await getBatchList();

    return reply.header("x-cache", cacheHit ? "HIT" : "MISS").send({ batches });
  });

  done();
};
