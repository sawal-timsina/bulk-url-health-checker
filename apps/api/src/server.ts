// Must stay first: loads and validates the environment.
import { config } from "./config.js";
import { closeDb, initDb } from "@bulk-url-checker/db";
import { runMigrations } from "@bulk-url-checker/db/migrate";
import { initRedis } from "@bulk-url-checker/queue";
import { buildApp } from "./app.js";
import { batchEventHub } from "./services/batch-events.js";

initDb(config.databaseUrl);
initRedis(config.redisUrl);

const app = buildApp();

async function start() {
  try {
    await runMigrations(config.databaseUrl);
    await app.listen({
      port: config.port,
      host: config.host,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

async function shutdown() {
  await app.close();
  await batchEventHub.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

void start();
