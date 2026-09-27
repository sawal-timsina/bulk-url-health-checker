import { randomUUID } from "node:crypto";
import { getRedis } from "./connection.js";

/*
 * Sliding-window log, evaluated atomically in Redis so it holds across every
 * worker process. Uses Redis's clock (TIME), not the workers', so clock skew
 * between hosts can't let extra requests through.
 *
 * Returns 0 when a slot was taken, otherwise how many ms until one frees up.
 */
const ACQUIRE_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local member = ARGV[3]

local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

if redis.call('ZCARD', key) < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return 0
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
return math.max(1, tonumber(oldest[2]) + window - now)
`;

export interface RateLimit {
  key: string;
  max: number;
  windowMs: number;
}

/**
 * Waits until a request slot is free, then takes it. Call immediately
 * before the outbound request.
 */
export async function acquireRateLimitSlot({ key, max, windowMs }: RateLimit): Promise<void> {
  const member = randomUUID();

  for (;;) {
    const waitMs = Number(await getRedis().eval(ACQUIRE_SCRIPT, 1, key, max, windowMs, member));

    if (waitMs === 0) {
      return;
    }

    // Jitter so waiting workers don't all retry in the same millisecond.
    await new Promise((resolve) => setTimeout(resolve, waitMs + Math.random() * 10));
  }
}
