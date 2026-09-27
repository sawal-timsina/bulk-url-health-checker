import { Queue } from "bullmq";
import { type UrlCheckJob, urlCheckJobId } from "@bulk-url-checker/shared";
import { createRedisConnection } from "./connection.js";

export const URL_CHECK_QUEUE = "url-checks";

let urlCheckQueue: Queue<UrlCheckJob> | undefined;

export function getUrlCheckQueue(): Queue<UrlCheckJob> {
  urlCheckQueue ??= new Queue<UrlCheckJob>(URL_CHECK_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      // Initial attempt + 3 retries.
      attempts: 4,

      // 1s, 2s, 4s between attempts.
      backoff: {
        type: "exponential",
        delay: 1000,
      },

      // Keep a small history for debugging.
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  });

  return urlCheckQueue;
}
