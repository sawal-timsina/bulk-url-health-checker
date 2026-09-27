import type { FastifyPluginCallback } from "fastify";
import { findBatchById, findUrlsByBatchId, toBatchDetails } from "@bulk-url-checker/db";
import type { GetBatchResponse } from "@bulk-url-checker/shared";
import { batchNotFound } from "../../lib/errors.js";
import { batchParamsSchema } from "../../schemas/batch.js";

export const getBatchRoute: FastifyPluginCallback = (app, _options, done) => {
  // Never cached: this is the snapshot clients rebuild from after a refresh or reconnect.
  app.get<{ Params: { id: string }; Reply: GetBatchResponse }>(
    "/:id",
    { schema: batchParamsSchema },
    async (request) => {
      const { id } = request.params;
      const [batch, urls] = await Promise.all([findBatchById(id), findUrlsByBatchId(id)]);

      if (!batch) {
        throw batchNotFound();
      }

      return { batch: toBatchDetails(batch, urls) };
    },
  );

  done();
};
