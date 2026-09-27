import type { RateLimit } from "./rate-limiter.js";
import { getUrlCheckQueue } from "./queues.js";

export const GLOBAL_CONCURRENCY = 5;

/*
 * 10 outbound requests in any 1s window, system-wide. The window is padded by
 * 50ms so network jitter between taking a slot and the request reaching the
 * target can't squeeze an 11th request into a 1s window at the target.
 *
 * Not BullMQ's global rate limit: it counts fixed windows, which allows up to
 * 2× the limit across a window boundary (measured: 16 in 1s).
 */
export const OUTBOUND_RATE_LIMIT: RateLimit = {
  key: "rate-limit:outbound-checks",
  max: 10,
  windowMs: 1050,
};

/**
 * Concurrency is stored in Redis on the queue itself, so it applies across
 * every worker process rather than per process.
 */
export async function configureUrlCheckQueue() {
  const queue = getUrlCheckQueue();

  await queue.setGlobalConcurrency(GLOBAL_CONCURRENCY);

  // Clear the fixed-window limit set by earlier versions; see OUTBOUND_RATE_LIMIT.
  await queue.removeGlobalRateLimit();
}
