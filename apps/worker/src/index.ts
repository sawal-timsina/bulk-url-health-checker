// Must stay first: loads and validates the environment.
import { config } from "./config.js";
import { closeDb, initDb } from "@bulk-url-checker/db";
import { runMigrations } from "@bulk-url-checker/db/migrate";
import { initRedis } from "@bulk-url-checker/queue";
import { createUrlCheckWorker, startUrlCheckWorker } from "./queue/url-check-worker.js";
import { reconcileUnfinishedUrls } from "./recovery/reconcile.js";

initDb(config.databaseUrl);
initRedis(config.redisUrl);

const urlCheckWorker = createUrlCheckWorker();

urlCheckWorker.on("error", (error) => {
  console.error("Worker error:", error);
});

async function main() {
  await runMigrations(config.databaseUrl);
  await startUrlCheckWorker(urlCheckWorker);

  const { checked, enqueued } = await reconcileUnfinishedUrls();

  console.log(`URL check worker started (reconciled ${checked} unfinished URLs, re-enqueued ${enqueued})`);
}

async function shutdown(signal: string) {
  console.log(`${signal} received, closing worker`);

  // Waits for in-flight checks; anything left is re-run by BullMQ's stalled-job check.
  await urlCheckWorker.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
