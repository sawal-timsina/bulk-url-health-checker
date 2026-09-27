import type { FastifyPluginCallback } from "fastify";
import { findBatchById, findUrlsByBatchId, toBatchDetails } from "@bulk-url-checker/db";
import type { BatchEvent } from "@bulk-url-checker/shared";
import { batchNotFound } from "../../lib/errors.js";
import { batchParamsSchema } from "../../schemas/batch.js";
import { batchEventHub } from "../../services/batch-events.js";

const HEARTBEAT_MS = 15_000;
const CLIENT_RETRY_MS = 2_000;

export const batchEventsRoute: FastifyPluginCallback = (app, _options, done) => {
  app.get<{ Params: { id: string } }>("/:id/events", { schema: batchParamsSchema }, async (request, reply) => {
    const { id } = request.params;

    if (!(await findBatchById(id))) {
      throw batchNotFound();
    }

    reply.hijack();

    const res = reply.raw;

    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disable proxy buffering (nginx) so events flush immediately.
      "x-accel-buffering": "no",
      // hijack() bypasses @fastify/cors, so set it here.
      "access-control-allow-origin": request.headers.origin ?? "*",
      vary: "origin",
    });
    res.write(`retry: ${CLIENT_RETRY_MS}\n\n`);

    let snapshotSent = false;
    const pending: string[] = [];

    const write = (data: string) => {
      res.write(`data: ${data}\n\n`);
    };

    const unsubscribe = await batchEventHub.subscribe(id, (message) => {
      if (snapshotSent) {
        write(message);
      } else {
        pending.push(message);
      }
    });

    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);

    const cleanup = () => {
      clearInterval(heartbeat);
      void unsubscribe();
    };

    request.raw.on("close", cleanup);

    try {
      const [batch, urls] = await Promise.all([findBatchById(id), findUrlsByBatchId(id)]);
      const snapshot: BatchEvent = { type: "snapshot", batch: toBatchDetails(batch!, urls) };

      write(JSON.stringify(snapshot));
      snapshotSent = true;

      // Events that raced the snapshot; the client keeps the newer row by updatedAt.
      for (const message of pending.splice(0)) {
        write(message);
      }
    } catch (error) {
      request.log.error(error, "Failed to send batch snapshot");
      cleanup();
      res.end();
    }
  });

  done();
};
