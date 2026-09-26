import type { FastifyPluginAsync } from "fastify";
import { createBatchRoute } from "./create.js";
import { getBatchRoute } from "./get.js";
import { listBatchRoute } from "./list.js";

export const batchRoutes: FastifyPluginAsync = async (app) => {
  await app.register(createBatchRoute);
  await app.register(listBatchRoute);
  await app.register(getBatchRoute);
};
