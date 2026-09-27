import { randomUUID } from "node:crypto";
import { type Batch, findBatchById } from "@bulk-url-checker/db";
import { getRedis } from "@bulk-url-checker/queue";
import { HttpError } from "../lib/errors.js";

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export interface BatchReservation {
  batchId: string;
  existing: Batch | null;
  release: () => Promise<void>;
}

export async function reserveBatchId(idempotencyKey: string | undefined): Promise<BatchReservation> {
  const batchId = randomUUID();

  if (!idempotencyKey) {
    return { batchId, existing: null, release: async () => {} };
  }

  const redis = getRedis();
  const key = `idempotency:create-batch:${idempotencyKey}`;
  const reserved = await redis.set(key, batchId, "EX", IDEMPOTENCY_TTL_SECONDS, "NX");

  if (reserved) {
    return { batchId, existing: null, release: () => redis.del(key).then(() => {}) };
  }

  const existingId = await redis.get(key);
  const existing = existingId ? await findBatchById(existingId) : null;

  if (!existing) {
    throw new HttpError(409, "REQUEST_IN_PROGRESS", "A batch with this Idempotency-Key is still being created");
  }

  return { batchId: existing.id, existing, release: async () => {} };
}
