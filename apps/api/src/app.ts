import cors from "@fastify/cors";
import Fastify from "fastify";
import { batchRoutes } from "./routes/batches/index.js";
import { healthRoutes } from "./routes/health.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
  });

  app.register(healthRoutes);
  app.register(batchRoutes, {
    prefix: "/batches",
  });

  return app;
}
