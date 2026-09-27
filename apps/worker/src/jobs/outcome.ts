import type { completeUrlAndUpdateBatch } from "@bulk-url-checker/db";
import type { UrlCheckOutput } from "../checks/check-url.js";
import { describeError } from "../checks/transient.js";
import { TransientHttpError } from "../checks/transient-http-error.js";

export type UrlOutcome = Omit<Parameters<typeof completeUrlAndUpdateBatch>[0], "urlId" | "generation">;

export type JobResult = { urlId: string; skipped: true } | { urlId: string; status: UrlOutcome["status"] };

export function outcomeFromResponse(result: UrlCheckOutput): UrlOutcome {
  const ok = result.httpStatus >= 200 && result.httpStatus < 400;

  return {
    status: ok ? "success" : "failed",
    httpStatus: result.httpStatus,
    responseTimeMs: result.responseTimeMs,
    title: result.title,
    error: ok ? null : `HTTP ${result.httpStatus}`,
  };
}

export function outcomeFromFailure(error: unknown, attempts: number): UrlOutcome {
  if (error instanceof TransientHttpError) {
    return {
      status: "failed",
      httpStatus: error.httpStatus,
      responseTimeMs: error.responseTimeMs,
      title: error.title,
      error: `HTTP ${error.httpStatus} after ${attempts} attempts`,
    };
  }

  return { status: "failed", error: describeError(error) };
}

export function outcomeFromInternalError(error: unknown): UrlOutcome {
  return { status: "failed", error: `Internal error: ${describeError(error)}` };
}
