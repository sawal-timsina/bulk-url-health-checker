export interface UrlCheckJob {
  batchId: string;
  urlId: string;
  generation: number;
}

/**
 * Deterministic jobId: re-enqueueing the same URL generation is a no-op in
 * BullMQ, while "retry failed" (generation + 1) gets a fresh job.
 */
export function urlCheckJobId(urlId: string, generation: number): string {
  return `url-check-${urlId}-${generation}`;
}
