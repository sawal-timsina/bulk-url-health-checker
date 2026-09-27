export interface UrlCheckOutput {
  httpStatus: number;
  responseTimeMs: number;
  title: string | null;
}

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_SIZE = 1_000_000;

export async function checkUrl(url: string): Promise<UrlCheckOutput> {
  const startedAt = performance.now();

  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "user-agent": "BulkURLHealthChecker/1.0",
    },
  });

  const contentType = response.headers.get("content-type") ?? "";

  let title: string | null = null;

  if (contentType.toLowerCase().includes("text/html")) {
    const contentLength = response.headers.get("content-length");

    if (!contentLength || Number(contentLength) <= MAX_RESPONSE_SIZE) {
      const body = await response.text();

      title = extractTitle(body);
    }
  }

  // Release the socket when the body wasn't read.
  if (!response.bodyUsed) {
    await response.body?.cancel();
  }

  const responseTimeMs = Math.round(performance.now() - startedAt);

  return {
    httpStatus: response.status,
    responseTimeMs,
    title,
  };
}

export function extractTitle(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

  if (!match) {
    return null;
  }

  const title = match[1]!.replace(/\s+/g, " ").trim();

  return title || null;
}
