# Bulk URL Health Checker

Submit a list of URLs (pasted or CSV). Each URL is checked in the background: final HTTP status, response time, and page
title. The batch page updates live as results arrive.

## Run it

```sh
podman compose up --build        # or: docker compose up --build
```

That's the whole system: Postgres, Redis, API, worker, a load balancer in front of the API, and the web UI. No `.env` is
needed.

- UI: http://localhost:3000
- API: http://localhost:3001

To run several API and worker instances, which is how the multi-instance guarantees are meant to be exercised:

```sh
API_REPLICAS=2 WORKER_REPLICAS=2 podman compose up --build    # pnpm start:scaled
API_REPLICAS=2 WORKER_REPLICAS=2 podman compose down          # pnpm stop
```

> Pass the same `*_REPLICAS` values to `down`. podman-compose only removes the replicas it computes from the file, so a
> plain `down` leaves `api_2`/`worker_2` running.

Compose reads `.env` when it exists: database credentials, published ports (`API_PORT`, `WEB_PORT`, `DB_PORT`,
`REDIS_PORT`), `PUBLIC_API_URL` and the replica counts. Everything has a default. Putting `API_REPLICAS` and
`WORKER_REPLICAS` in `.env` also makes a plain `down` remove every replica. Connection URLs are the exception: `.env`
points them at `localhost` for local development, so compose builds its own from service names.

### Check that the limits actually hold

With the system running (ideally scaled as above):

```sh
pnpm install && pnpm verify:limits
```

This starts a local HTTP server, submits 60 of its URLs plus 2 that always return 503, and measures what arrives **at
the target**. Measuring there means nothing can pass just because our own logs look right:

```
PASS  rate limit                     max 10 requests in any 1000ms window (limit 10)
PASS  concurrency                    max 5 in flight (limit 5)
PASS  each healthy URL checked once  60 requests for 60/60 URLs
PASS  retries (flaky a)              4 attempts, gaps 1082ms → 2110ms → 4024ms (want ≥ 1000 → 2000 → 4000ms)
PASS  retries (flaky b)              4 attempts, gaps 1027ms → 2101ms → 4022ms (want ≥ 1000 → 2000 → 4000ms)
PASS  persisted state                batch completed 62/62; flaky rows: failed/4 attempts, failed/4 attempts
```

The workers must be able to reach your machine. `TARGET_HOST` sets the address they use:

- `host.containers.internal` (default): Podman.
- `host.docker.internal`: Docker Desktop.
- `localhost`: workers running via `pnpm dev`.

Unit tests: `pnpm test`.

### Local development

```sh
cp .env.example .env
pnpm install
pnpm infra:up        # Postgres + Redis only
pnpm dev             # api (tsx watch), worker, next dev
```

Migrations run automatically when the API or worker starts. `pnpm db:migrate` also runs them.

## Architecture

```
                   ┌──────────────┐  Server Components / Server Actions
 browser ─────────▶│ web (Next.js)│───────────────┐
    │              └──────────────┘               │ HTTP (API_URL)
    │ SSE (PUBLIC_API_URL)                        ▼
    │                                       ┌──────────┐
    └──────────────────────────────────────▶│ api-lb   │ nginx, round-robin
                                            └────┬─────┘
                                   ┌─────────────┴─────────────┐
                                   ▼                           ▼
                              ┌────────┐                  ┌────────┐
                              │ api #1 │ … Fastify …      │ api #N │
                              └─┬───┬──┘                  └─┬───┬──┘
             writes/reads batch │   │ enqueue · cache ·     │   │
                  state         │   │ subscribe (pub/sub)   │   │
                                ▼   ▼                       ▼   ▼
                         ┌────────────┐              ┌──────────────┐
                         │ PostgreSQL │◀────────────▶│    Redis     │
                         │ (truth)    │              │ BullMQ queue │
                         └────────────┘              │ rate limiter │
                                ▲                    │ pub/sub      │
            claim / complete    │                    │ list cache   │
                                │                    └──────────────┘
                         ┌──────┴─────┐  consume jobs      ▲
                         │ worker × M │────────────────────┘
                         └────────────┘  publish events
```

| Path              | What it is                                                            |
|-------------------|-----------------------------------------------------------------------|
| `apps/api`        | Fastify HTTP API: create, list, get, cancel, retry-failed, SSE stream |
| `apps/worker`     | BullMQ worker, a **separate process**: the HTTP checks                |
| `apps/web`        | Next.js UI                                                            |
| `packages/shared` | Types and constants shared by all of the above, including the browser |
| `packages/db`     | Drizzle schema, migrations, repositories, row→DTO mappers             |
| `packages/queue`  | Everything Redis: queue, rate limiter, pub/sub, cache invalidation    |

### Why each piece exists (and what breaks without it)

- **PostgreSQL is the source of truth** for batch and URL state. Every state change is a conditional
  `UPDATE … WHERE status = …`, so concurrent writers can't produce an impossible state. Without it, state would live in
  Redis job data, which is lost when jobs are evicted and can't be queried for the list view.
- **Redis + BullMQ** hold the work queue, which survives API and worker crashes (Redis runs with Append-only file). They
  also provide
  global concurrency across worker processes, retries with exponential backoff, and stalled-job recovery. Without them,
  work would be lost on restart, and no limit could hold across processes.
- **Redis sliding-window rate limiter** (`packages/queue/src/rate-limiter.ts`) enforces 10 requests/second across all
  workers. See _Guarantees_ for why this isn't BullMQ's own limiter.
- **Redis pub/sub** gets events from any worker to every API instance, and so to every connected browser, whichever
  instance it's attached to. Without it, a client on API #2 would never hear about work done by a worker that notified
  API #1.
- **Redis list cache** gives the 30s batch-list cache that all API instances share and invalidate together. An
  in-process cache would serve stale data on the instances that didn't handle the write.
- **nginx (`api-lb`)** is only there so `API_REPLICAS=N` is real: browsers and the web server reach whichever replica
  they're routed to. It re-resolves the replicas every 5s.

## Data model

```
batches: id, status (pending → running → completed | cancelled), total_count, completed_count, timestamps
urls:    id, batch_id, url, status (queued → processing → success | failed | cancelled),
         http_status, response_time_ms, title, error, attempts, generation, timestamps
         unique (batch_id, url)
```

`completed_count` is updated in the same transaction as the URL that finished, and the batch flips to `completed` in
that same statement when the count reaches `total_count`. `generation` is bumped by "retry failed" (see _Idempotency_).

## Guarantees and how they're enforced

**Persist before processing.** `POST /batches` validates every URL (a 400 lists the invalid ones), normalises them,
removes duplicates, and inserts the batch and all its URLs in **one transaction**. Only then does it enqueue one BullMQ
job per URL (`addBulk`). A worker can never receive a job for a URL that isn't in Postgres.

**Global concurrency: 5 checks in flight.** This uses BullMQ's queue-level `setGlobalConcurrency(5)`, which is stored in
Redis and enforced across all worker processes. Each process also caps itself at 5.

**Global rate limit: 10 requests/second.** Each worker takes a slot from a Redis sorted set of recent request times
immediately before every HTTP attempt, retries included. This is an atomic Lua script that uses Redis's own clock, so
clock skew between worker hosts doesn't matter.

- BullMQ's built-in global rate limit is **not** used. It counts in fixed windows, so up to 10 requests can land at the
  end of one window and 10 more at the start of the next. We measured 16 within one real second, so it doesn't meet the
  spec.
- The window is padded to 1050ms so network jitter can't squeeze an 11th request into a 1s window at the target.

**Retries: up to 3 on transient failure, with exponential backoff.** BullMQ runs `attempts: 4` with an exponential
backoff of 1s → 2s → 4s.

- **Transient:** timeouts, connection resets/refusals, and HTTP 408, 425, 429, 500, 502, 503, 504.
- **Permanent, not retried:** DNS "not found", TLS certificate errors, and all other HTTP statuses.
- Between attempts the URL stays `processing`, and `attempts` counts every real try.

**Surviving crashes.**

- **Worker dies mid-check:** BullMQ's stalled-job detection re-runs the job. Claiming is
  `queued|processing → processing`, so the re-run proceeds instead of being skipped.
- **Infrastructure error outlasts every attempt:** the job's final `failed` event marks the URL failed, so the batch
  still completes.
- **API crashes between the DB commit and the enqueue:** on startup, every worker reconciles. Unfinished URLs in active
  batches with no live job are re-enqueued, and deterministic job ids make that safe to repeat.

## Idempotency

| Operation     | Why repeating it is safe                                                                                                                                                                                                                                   |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Enqueue       | jobId = `url-check-{urlId}-{generation}`: a second add for the same URL generation is a no-op in BullMQ. The reconciler relies on this.                                                                                                                    |
| Job execution | Every transition is a conditional update: claim needs `queued/processing` plus the same generation, and completion needs `processing` plus the same generation. A duplicate or stale job changes nothing, and `completed_count` can't double-count.        |
| Create batch  | Optional `Idempotency-Key` header. The key reserves the batch id in Redis (`SET NX`, 24h), so a repeat returns the original batch (200) instead of creating another. The UI sends a key per form content, so double-submits and retried requests are safe. |
| Cancel        | Only `pending/running` batches can be cancelled. A second cancel returns 409, and state is unchanged.                                                                                                                                                      |
| Retry failed  | Only rows currently `failed` are touched. A second call finds none and returns `retriedCount: 0`.                                                                                                                                                          |

## Live updates: SSE + Redis pub/sub

`GET /batches/:id/events` is a Server-Sent Events stream.

- **Why SSE:** updates flow one way (server → browser). SSE is plain HTTP, works through the load balancer and proxies,
  and `EventSource` reconnects automatically with no library. WebSockets would add a bidirectional protocol we don't
  need, plus our own reconnect logic. Polling was the other option; SSE gives immediate updates without hammering the
  API.
- **Multi-instance:** a worker publishes `url.updated` (the full URL row plus batch counters) to Redis channel
  `batch-events:{id}`. Every API instance subscribes on behalf of its own SSE clients, using one Redis subscriber per
  process and reference-counted channels. So it doesn't matter which instance a browser is connected to. Verified with 2
  replicas: two streams on different instances both received every update.
- **Refresh-safe:** the batch page is a Server Component that renders from `GET /batches/:id` (Postgres) on every
  request. A refresh, a new tab, or a shared link shows the true state immediately, whether the batch is running or
  finished.
- **Dropped connection:** every SSE connection, including automatic reconnects, starts with a full `snapshot` from
  Postgres.
  - The server subscribes _before_ reading the snapshot and holds live events until the snapshot has been sent, so
    nothing that happened in between is lost.
  - Events carry full rows. The client keeps whichever copy of a row has the newer `updatedAt`, so duplicate or
    out-of-order events are harmless.
  - If the browser gives up reconnecting (for example, a non-200 while the API restarts), the client reconnects itself.
    The UI shows _Live / Reconnecting…_.
- Pub/sub is fire-and-forget, and that's fine because it's only a notification channel. A lost message only matters
  until the next snapshot. Truth stays in Postgres.

## Controls

- **Cancel** (`POST /batches/cancel` with `{ "id": "<batch id>" }`): one transaction marks the batch and all `queued`/`processing` URLs
  `cancelled`. Queued jobs are then removed from BullMQ so they don't use rate-limit slots.
  - A check already in flight finishes its HTTP request, but its result is discarded: completion only writes to a URL
    that is still `processing`.
  - What the user sees (cancelled rows) is exactly what's persisted.
- **Retry failed only** (`POST /batches/retry-failed` with `{ "id": "<batch id>" }`): one transaction resets only `failed` rows to `queued`, bumps
  their `generation`, clears their results, decrements `completed_count` by the same number, and sets the batch back to
  `running`.
  - Successful rows aren't touched: same attempts, same `completed_at`.
  - New jobs are enqueued under the new generation. The old job ids still exist in BullMQ's completed set and would
    otherwise deduplicate the retry away.

## Caching

`GET /batches` is served from Redis for up to 30s (`x-cache: HIT|MISS` header).

- **Invalidation:** the cache is invalidated whenever a batch is created or changes status (starts, completes, is
  cancelled or retried), by the API or the worker.
- **Versioned keys:** invalidation increments a version number, and readers cache under `…:v{version}`. A slow read that
  started before an invalidation writes to a stale key that nobody reads anymore. A plain `DEL` would let that slow read
  put stale data back for the full 30s.
- **Shared:** the cache lives in Redis, so every API instance shares it and sees invalidations immediately.

## Type safety

`packages/shared` defines the API contract: request/response DTOs, the SSE event union, status enums, job payloads and
the channel/cache-key helpers.

- The API types its routes with Fastify's `Reply` generic against these types.
- DB rows are converted to DTOs in exactly one place (`packages/db/src/mappers.ts`).
- The web app imports the same types in Server Components, Server Actions and the client-side event reducer.

## Next.js decisions

- **Routing:** `/` lists batches and has the submit form. `/batches/[id]` is the batch page, with its own `loading`,
  `not-found` and `error` boundaries.
- **Server / client boundary:**
  - Pages are Server Components that fetch on the server.
  - Only the interactive parts are Client Components: the form, and the live batch view that receives the
    server-rendered snapshot as its initial state.
- **Where and when data is fetched:**
  - At request time only. Both routes call `connection()`, and fetches use `cache: "no-store"`. Batch state changes
    every second, and the API owns caching, so Next must not add a second cache layer that doesn't know about
    invalidation.
  - The list is streamed inside `<Suspense>`.
- **Mutations are Server Actions.**
  - Create parses pasted text or CSV on the server, calls the API with an idempotency key, then `redirect`s to the new
    batch.
  - Cancel and retry return the fresh batch state, because a cancel ends the live stream.
- **Two API addresses:** the web server calls the API over the internal network (`API_URL`). The browser's SSE URL
  (`PUBLIC_API_URL`) is read at request time and passed down as a prop, not baked in at build time as `NEXT_PUBLIC_*`
  would be. That lets the same image run anywhere.

## Horizontal scaling

- **API:** stateless apart from SSE connections. Any instance can serve any request, and pub/sub delivers events to
  clients on all instances. The list cache is shared, and so are idempotency keys (both in Redis). Scaling the API adds
  capacity for connections and requests.
- **Worker:** add as many as you like. Concurrency (5) and rate (10/s) are global, enforced in Redis, so more workers
  mean more resilience, not more throughput. Throughput is capped by design.
- **Migrations:** run by every API and worker process on boot, under a Postgres advisory lock. Start order and replica
  count don't matter: one migrates, the rest wait and find nothing to do.
- **Redis and Postgres are single instances here.** Scaling them (Sentinel/Cluster, a read replica for the list) would
  be the next step, and nothing in the app assumes otherwise.

## Assumptions

- **Final status:** redirects are followed (`redirect: "follow"`). "Final HTTP status" is the status after the last
  redirect. The redirect chain counts as **one** request for rate limiting.
- **Success rule:** a final 2xx/3xx is `success`. 4xx and non-transient 5xx are `failed` without retries. Transient
  statuses are retried, then `failed`.
- **Title:** read from `<title>` for `text/html` responses up to 1 MB. There's a 10s timeout per attempt.
- **Response time:** includes reading the body when a title is extracted.
- **Normalisation:** URLs are normalised (scheme and host lower-cased, fragment dropped). Duplicates within a batch are
  checked once. A batch holds at most 10,000 URLs.
- **Cancelled checks:** a check already in flight when its batch is cancelled finishes, and its result is discarded. We
  don't abort the socket.
- **Retry on cancelled batches:** "Retry failed" isn't allowed on a cancelled batch (409).
- **List freshness:** the list shows progress counters too. They may lag up to 30s, which is the cache TTL. Status
  changes invalidate immediately.

## Trade-offs, and what I'd do with more time

- **One Docker image for every service.** It's simple and keeps versions in lockstep, at the cost of image size. With
  more time: per-service slim images (`pnpm deploy`, Next standalone output).
- **Migrations on boot** instead of a separate migrate job. I tried a separate job, but podman-compose started the API
  and worker before it finished, and the advisory lock makes on-boot migration safe. For production I'd use a one-off
  migration job in the deploy pipeline.
- **Pub/sub isn't durable.** Correctness comes from the snapshot on (re)connect, not from delivering every message.
  Redis Streams with `Last-Event-ID` resume would avoid resending the whole snapshot to a big batch on every reconnect.
- **Snapshot size:** a 10,000-URL batch sends everything on connect. With more time: paginate the table and send
  per-status counts plus the visible page.
- **Tests:** unit tests cover the pure logic. The limits are proven end to end with `verify:limits` rather than in CI.
  Next I'd add integration tests (Testcontainers) for the repository transitions and the cancel/retry races, and
  Playwright for the live page.
- **Rate-limit waits:** a job waiting for a rate-limit slot holds one of the 5 concurrency slots. At 10/s this costs
  nothing, but a token bucket that reserves future slots would avoid the polling.
- **One Redis for everything.** The queue, rate limiter, pub/sub, idempotency keys and list cache share one instance,
  but they want opposite settings. BullMQ needs `maxmemory-policy noeviction` and AOF persistence (evicting a job key
  loses work), while a cache wants `allkeys-lru` and no persistence. With more time I'd run two:
  - a **durable Redis** for BullMQ, the rate limiter, pub/sub and idempotency keys;
  - a **disposable cache Redis** (LRU eviction, no AOF) for the batch list.

  A cache memory spike could then never starve the queue, and the cache could be flushed or restarted freely. The code
  change is small: all Redis access already goes through `packages/queue`, so the cache would take its own
  `CACHE_REDIS_URL` (defaulting to `REDIS_URL`) and compose would get a second `redis-cache` service.

- **Operations:** auth, metrics (queue depth, rate-limit waits) and a dead-letter view are out of scope.

## API reference

| Method | Path                        | Notes                                                                                                             |
|--------|-----------------------------|-------------------------------------------------------------------------------------------------------------------|
| `POST` | `/batches`                  | `{ urls: string[] }`, optional `Idempotency-Key` header → 202 `{ batch }` (200 on replay), 400 lists invalid URLs |
| `GET`  | `/batches`                  | `{ batches }`, cached 30s (`x-cache`)                                                                             |
| `GET`  | `/batches/:id`              | `{ batch: { …, urls } }`, never cached                                                                            |
| `GET`  | `/batches/:id/events`       | SSE: `snapshot` first, then `url.updated`                                                                         |
| `POST` | `/batches/cancel`           | `{ id }` → `{ batch }`; 409 if already completed/cancelled                                                        |
| `POST` | `/batches/retry-failed`     | `{ id }` → `{ batch, retriedCount }`; 409 if cancelled                                                            |
| `GET`  | `/health`                   | Liveness                                                                                                          |

`apps/api/api-test.http` has ready-made requests.
