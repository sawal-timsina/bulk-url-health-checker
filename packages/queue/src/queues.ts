import { Queue } from "bullmq";
import type { UrlCheckJob } from "@bulk-url-checker/shared";
import { createRedisConnection } from "./connection";

export const URL_CHECK_QUEUE = "url-checks";

const queueConnection = createRedisConnection();

export const urlCheckQueue = new Queue<UrlCheckJob>(URL_CHECK_QUEUE, {
  connection: queueConnection,
  defaultJobOptions: {
    // Initial attempt + 3 retries.
    attempts: 4,

    backoff: {
      type: "exponential",
      delay: 1000,
    },

    // Keep a small history for debugging.
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});
