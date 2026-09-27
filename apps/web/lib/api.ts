import "server-only";
import type { ApiError } from "@bulk-url-checker/shared";
import { getServerConfig } from "./config";

/**
 * Server-side API access (Server Components and Server Actions only).
 * The API address may be internal (e.g. the compose service name); the
 * browser gets publicApiUrl() instead.
 */
function apiUrl(path: string): string {
  return new URL(path, getServerConfig().apiUrl).toString();
}

export function publicApiUrl(): string {
  return getServerConfig().publicApiUrl;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(body?.message ?? `API request failed with ${status}`);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("content-type", "application/json");

  const response = await fetch(apiUrl(path), {
    ...init,
    // Batch state changes every second; the API owns caching (the list is
    // cached in Redis), so Next must not add a second, unaware cache layer.
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;

    throw new ApiRequestError(response.status, body);
  }

  return (await response.json()) as T;
}
