export const URL_CHECK_STATUSES = [
  "queued",
  "processing",
  "success",
  "failed",
  "cancelled",
] as const;

export type UrlCheckStatus = (typeof URL_CHECK_STATUSES)[number];
