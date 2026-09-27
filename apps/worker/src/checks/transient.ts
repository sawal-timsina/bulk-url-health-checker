import type { UrlCheckOutput } from "./check-url.js";
import { TransientHttpError } from "./transient-http-error.js";

export function isTransientHttpStatus(status: number): boolean {
  return [
    408, // Request Timeout
    425, // Too Early
    429, // Too Many Requests
    500,
    502,
    503,
    504,
  ].includes(status);
}

// Failures that won't fix themselves by retrying a few seconds later.
const PERMANENT_NETWORK_CODES = new Set([
  "ENOTFOUND",
  "ERR_INVALID_URL",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

/**
 * fetch() rejects with a TypeError("fetch failed") whose `cause` carries the
 * underlying socket/DNS/TLS error code; timeouts reject with TimeoutError.
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return true;
  }

  if (error.name === "TypeError") {
    const code = (error.cause as { code?: unknown } | undefined)?.code;

    return typeof code !== "string" || !PERMANENT_NETWORK_CODES.has(code);
  }

  return false;
}

export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error";
  }

  const code = (error.cause as { code?: unknown } | undefined)?.code;

  return typeof code === "string" ? `${error.message} (${code})` : error.message;
}

/**
 * A response whose status is worth retrying, as an error carrying what was
 * measured (so the final failure can still record status, time and title);
 * null for any other response.
 */
export function transientErrorFor(result: UrlCheckOutput): TransientHttpError | null {
  if (!isTransientHttpStatus(result.httpStatus)) {
    return null;
  }

  return new TransientHttpError(
    `Transient HTTP status: ${result.httpStatus}`,
    result.httpStatus,
    result.responseTimeMs,
    result.title,
  );
}
