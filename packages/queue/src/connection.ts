import { Redis } from "ioredis";

let redisUrl: string | undefined;
let sharedClient: Redis | undefined;

/**
 * Called once by each app at startup with its validated config; the package
 * never reads process.env itself.
 */
export function initRedis(url: string) {
  redisUrl = url;
}

export function createRedisConnection(): Redis {
  if (!redisUrl) {
    throw new Error("Redis not initialised: call initRedis() at startup");
  }

  return new Redis(redisUrl, {
    // Required by BullMQ for blocking connections; harmless elsewhere.
    maxRetriesPerRequest: null,
  });
}

/**
 * Process-wide connection for plain commands (cache, publish, rate limiter).
 * Subscribers and BullMQ workers need their own dedicated connections.
 */
export function getRedis(): Redis {
  sharedClient ??= createRedisConnection();

  return sharedClient;
}
