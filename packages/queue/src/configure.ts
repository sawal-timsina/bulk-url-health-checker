import { urlCheckQueue } from "./queues.js";

export async function configureUrlCheckQueue() {
  await urlCheckQueue.setGlobalConcurrency(5);

  await urlCheckQueue.setGlobalRateLimit(10, 1000);
}
