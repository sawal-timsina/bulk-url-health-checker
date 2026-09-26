import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL!;

if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

export function createRedisConnection() {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}
