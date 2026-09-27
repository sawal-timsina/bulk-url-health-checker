/**
 * End-to-end check that the processing guarantees hold in practice, measured
 * at the receiving end (the only place that can't be fooled by our own logs).
 *
 * Starts a local HTTP server, submits a batch of its URLs to the running API,
 * waits for the batch to finish, then checks what the server observed:
 *
 *   - rate:        ≤ 10 requests in any 1s window, across all workers
 *   - concurrency: ≤ 5 requests in flight at once, across all workers
 *   - retries:     an always-503 URL is tried exactly 4 times (1 + 3 retries),
 *                  with gaps growing ~1s → 2s → 4s (exponential backoff)
 *   - no URL is checked more times than it should be (idempotency)
 *
 * Run it against the system started with several workers, e.g.
 *   API_REPLICAS=2 WORKER_REPLICAS=2 podman compose up --build
 *   pnpm verify:limits
 *
 * Options (env): API_URL (default http://localhost:3001),
 * TARGET_HOST: how workers reach this machine (default host.containers.internal;
 * use localhost when workers run via `pnpm dev`), PORT (default 4020),
 * URLS (default 60).
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import type { CreateBatchResponse, GetBatchResponse } from "@bulk-url-checker/shared";

const API_URL = process.env.API_URL ?? "http://localhost:3001";
const TARGET_HOST = process.env.TARGET_HOST ?? "host.containers.internal";
const PORT = Number(process.env.PORT ?? 4020);
const URL_COUNT = Number(process.env.URLS ?? 60);

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 1000;
const MAX_IN_FLIGHT = 5;
const EXPECTED_ATTEMPTS = 4;
const BACKOFF_MS = [1000, 2000, 4000];

interface Hit {
  path: string;
  start: number;
  end: number;
}

const hits: Hit[] = [];
let inFlight = 0;
let maxInFlight = 0;

// Varied latencies so concurrency, not just rate, is exercised.
function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  const start = Date.now();
  const url = new URL(req.url ?? "/", "http://target");
  const delay = Number(url.searchParams.get("delay") ?? 0);

  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);

  setTimeout(() => {
    const status = url.pathname.startsWith("/flaky") ? 503 : 200;

    res.writeHead(status, { "content-type": "text/html" });
    res.end(`<html><head><title>verify ${url.pathname}</title></head></html>`);

    inFlight -= 1;
    hits.push({ path: url.pathname + url.search, start, end: Date.now() });
  }, delay);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  headers.set("content-type", "application/json");

  const response = await fetch(new URL(path, API_URL), { ...init, headers });

  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

function densestWindow<T extends { start: number }>(items: T[], windowMs: number): T[] {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  let best: T[] = [];
  let left = 0;

  for (let right = 0; right < sorted.length; right += 1) {
    while (sorted[right]!.start - sorted[left]!.start >= windowMs) {
      left += 1;
    }

    if (right - left + 1 > best.length) {
      best = sorted.slice(left, right + 1);
    }
  }

  return best;
}

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

async function main() {
  const server = http.createServer(handler);

  await new Promise<void>((resolve) => server.listen(PORT, resolve));

  const runId = randomUUID().slice(0, 8);
  const base = `http://${TARGET_HOST}:${PORT}`;

  const urls = [
    ...Array.from({ length: URL_COUNT }, (_, i) => `${base}/ok/${runId}/${i}?delay=${[0, 50, 200, 600][i % 4]}`),
    `${base}/flaky/${runId}/a`,
    `${base}/flaky/${runId}/b`,
  ];

  console.log(`Submitting ${urls.length} URLs to ${API_URL} (target ${base})…`);

  const { batch } = await api<CreateBatchResponse>("/batches", {
    method: "POST",
    body: JSON.stringify({ urls }),
  });

  const startedAt = Date.now();
  let details: GetBatchResponse["batch"];

  for (;;) {
    details = (await api<GetBatchResponse>(`/batches/${batch.id}`)).batch;

    if (details.status === "completed" || details.status === "cancelled") {
      break;
    }

    if (Date.now() - startedAt > 120_000) {
      throw new Error(`Batch ${batch.id} did not finish within 2 minutes (${details.status})`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  server.close();

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  // Only this run's requests (the server is fresh, but be explicit).
  const runHits = hits.filter((hit) => hit.path.includes(runId));
  const densest = densestWindow(runHits, RATE_WINDOW_MS);
  const maxRate = densest.length;

  check(
    "rate limit",
    maxRate <= RATE_LIMIT,
    `max ${maxRate} requests in any ${RATE_WINDOW_MS}ms window (limit ${RATE_LIMIT})`,
  );

  if (maxRate > RATE_LIMIT) {
    const t0 = densest[0]!.start;

    console.log(`Densest window:\n${densest.map((hit) => `  +${hit.start - t0}ms ${hit.path}`).join("\n")}`);
  }
  check("concurrency", maxInFlight <= MAX_IN_FLIGHT, `max ${maxInFlight} in flight (limit ${MAX_IN_FLIGHT})`);

  const okHits = runHits.filter((hit) => hit.path.startsWith("/ok/"));
  const okPaths = new Set(okHits.map((hit) => hit.path));

  check(
    "each healthy URL checked once",
    okHits.length === URL_COUNT && okPaths.size === URL_COUNT,
    `${okHits.length} requests for ${okPaths.size}/${URL_COUNT} URLs`,
  );

  for (const name of ["a", "b"]) {
    const attempts = runHits
      .filter((hit) => hit.path === `/flaky/${runId}/${name}`)
      .map((hit) => hit.start)
      .sort((a, b) => a - b);

    const gaps = attempts.slice(1).map((time, i) => time - attempts[i]!);
    // Backoff sets a minimum; the rate limiter may add a little on top.
    const backoffOk = gaps.every((gap, i) => gap >= BACKOFF_MS[i]! * 0.9);

    check(
      `retries (flaky ${name})`,
      attempts.length === EXPECTED_ATTEMPTS && backoffOk,
      `${attempts.length} attempts, gaps ${gaps.map((gap) => `${gap}ms`).join(" → ") || "none"} (want ≥ ${BACKOFF_MS.join(" → ")}ms)`,
    );
  }

  const rows = details.urls;
  const flakyRows = rows.filter((row) => row.url.includes("/flaky/"));

  check(
    "persisted state",
    details.status === "completed" &&
      details.completedCount === rows.length &&
      rows.filter((row) => row.status === "success").length === URL_COUNT &&
      flakyRows.every((row) => row.status === "failed" && row.attempts === EXPECTED_ATTEMPTS && row.httpStatus === 503),
    `batch ${details.status} ${details.completedCount}/${details.totalCount}; flaky rows: ${flakyRows
      .map((row) => `${row.status}/${row.attempts} attempts`)
      .join(", ")}`,
  );

  console.log(`\nBatch ${batch.id} finished in ${elapsed}s\n`);

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name.padEnd(30)} ${result.detail}`);
  }

  process.exit(results.every((result) => result.ok) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
