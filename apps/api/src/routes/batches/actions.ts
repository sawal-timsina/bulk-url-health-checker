import type { FastifyPluginCallback } from "fastify";
import type { BatchActionRequest, BatchActionResponse, RetryFailedResponse } from "@bulk-url-checker/shared";
import { batchActionSchema } from "../../schemas/batch.js";
import { cancelBatch } from "../../services/cancel-batch-service.js";
import { retryFailed } from "../../services/retry-failed-service.js";

export const batchActionRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.post<{ Body: BatchActionRequest; Reply: BatchActionResponse }>(
    "/cancel",
    { schema: batchActionSchema },
    async (request) => ({ batch: await cancelBatch(request.body.id) }),
  );

  app.post<{ Body: BatchActionRequest; Reply: RetryFailedResponse }>(
    "/retry-failed",
    { schema: batchActionSchema },
    (request) => retryFailed(request.body.id),
  );

  done();
};
