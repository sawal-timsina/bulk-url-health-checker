import { startWorker, urlCheckWorker } from "./worker.js";

urlCheckWorker.on("completed", (job) => {
  console.log(`Job completed: ${job.id}`);
});

urlCheckWorker.on("failed", (job, error) => {
  console.error(`Job failed: ${job?.id}`, error);
});

urlCheckWorker.on("error", (error) => {
  console.error("Worker error:", error);
});

async function main() {
  await startWorker();

  console.log("URL check worker started");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
