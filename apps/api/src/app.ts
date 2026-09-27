import cors from "@fastify/cors";
import Fastify, { type FastifyError } from "fastify";
import { HttpError } from "./lib/errors.js";
import { batchRoutes } from "./routes/batches/index.js";
import { healthRoutes } from "./routes/health.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send(error.toBody());
    }

    if (error.validation) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", message: error.message });
    }

    request.log.error(error);

    return reply.code(500).send({ error: "INTERNAL_ERROR", message: "Internal server error" });
  });

  app.register(healthRoutes);
  app.register(batchRoutes, {
    prefix: "/batches",
  });

  return app;
}
