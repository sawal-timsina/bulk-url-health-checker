import Fastify from "fastify";
import cors from "@fastify/cors";

import { healthRoutes } from "./routes/health";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
  });

  app.register(healthRoutes);
  // app.register(batchRoutes, {
  //   prefix: "/batches",
  // });

  return app;
}
