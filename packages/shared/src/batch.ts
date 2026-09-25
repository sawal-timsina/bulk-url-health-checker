export const BATCH_STATUSES = [
  "pending",
  "running",
  "completed",
  "cancelled",
] as const;

export type BatchStatus = (typeof BATCH_STATUSES)[number];
