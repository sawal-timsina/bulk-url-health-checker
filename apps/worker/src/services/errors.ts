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
export function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return true;
  }

  return error.name === "TimeoutError" || error.name === "AbortError" || true;
}
