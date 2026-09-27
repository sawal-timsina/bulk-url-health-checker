"use client";

import { useEffect, useMemo, useReducer, useState, useTransition } from "react";
import {
  type BatchDetails,
  type BatchEvent,
  TERMINAL_BATCH_STATUSES,
  type UrlCheckResult,
  type UrlCheckStatus,
} from "@bulk-url-checker/shared";
import { cancelBatchAction, retryFailedAction } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { ProgressBar } from "./progress-bar";
import { StatusBadge } from "./status-badge";

const isNewer = (incoming: { updatedAt: string }, current: { updatedAt: string }) =>
  incoming.updatedAt >= current.updatedAt;

function reducer(state: BatchDetails, action: BatchEvent): BatchDetails {
  switch (action.type) {
    case "snapshot":
      return action.batch;

    case "url.updated": {
      const urls = state.urls.map((url) => (url.id === action.url.id && isNewer(action.url, url) ? action.url : url));

      return isNewer(action.batch, state) ? { ...state, ...action.batch, urls } : { ...state, urls };
    }
  }
}

type Connection = "connecting" | "live" | "reconnecting" | "closed";

const RECONNECT_DELAY_MS = 2_000;

function useBatchEvents(apiUrl: string, batchId: string, active: boolean, dispatch: (action: BatchEvent) => void) {
  // Only the stream callbacks set this; "closed" is derived from `active` below.
  const [connection, setConnection] = useState<Exclude<Connection, "closed">>("connecting");

  useEffect(() => {
    if (!active) {
      return;
    }

    let source: EventSource | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      source = new EventSource(new URL(`/batches/${batchId}/events`, apiUrl));

      source.onopen = () => setConnection("live");

      source.onmessage = (message: MessageEvent<string>) => {
        dispatch(JSON.parse(message.data) as BatchEvent);
      };

      source.onerror = () => {
        if (disposed) {
          return;
        }

        // CONNECTING: the browser is already retrying. CLOSED: it gave up
        // (e.g. a non-200 during an API restart), so retry ourselves.
        setConnection("reconnecting");

        if (source?.readyState === EventSource.CLOSED) {
          retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      source?.close();
      // The next stream (e.g. after "retry failed") starts from "connecting".
      setConnection("connecting");
    };
  }, [apiUrl, batchId, active, dispatch]);

  return active ? connection : "closed";
}

const connectionLabel: Record<Connection, string> = {
  connecting: "Connecting…",
  live: "● Live",
  reconnecting: "Reconnecting…",
  closed: "Finished",
};

export function BatchView({ initialBatch, apiUrl }: { initialBatch: BatchDetails; apiUrl: string }) {
  const [batch, dispatch] = useReducer(reducer, initialBatch);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = !(TERMINAL_BATCH_STATUSES as readonly string[]).includes(batch.status);
  const connection = useBatchEvents(apiUrl, batch.id, active, dispatch);

  const counts = useMemo(() => {
    const result: Record<UrlCheckStatus, number> = { queued: 0, processing: 0, success: 0, failed: 0, cancelled: 0 };

    for (const url of batch.urls) {
      result[url.status] += 1;
    }

    return result;
  }, [batch.urls]);

  const runAction = (action: (id: string) => ReturnType<typeof cancelBatchAction>) => {
    setActionError(null);
    startTransition(async () => {
      const result = await action(batch.id);

      if (result.ok) {
        // Fresh state from Postgres; if the batch became active again
        // (retry), the stream reopens and takes over from here.
        dispatch({ type: "snapshot", batch: result.batch });
      } else {
        setActionError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <StatusBadge status={batch.status} />
        <ProgressBar done={batch.completedCount} total={batch.totalCount} />
        <span className="text-sm text-gray-500" aria-live="polite">
          {connectionLabel[connection]}
        </span>
      </div>

      <p className="text-sm text-gray-600">
        Created {formatDate(batch.createdAt)} · {counts.success} succeeded · {counts.failed} failed ·{" "}
        {counts.processing} in progress · {counts.queued} queued · {counts.cancelled} cancelled
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!active || pending}
          onClick={() => runAction(cancelBatchAction)}
          className="rounded border px-3 py-1 text-sm disabled:opacity-40"
        >
          Cancel batch
        </button>
        <button
          type="button"
          disabled={counts.failed === 0 || batch.status === "cancelled" || pending}
          onClick={() => runAction(retryFailedAction)}
          className="rounded border px-3 py-1 text-sm disabled:opacity-40"
        >
          Retry failed ({counts.failed})
        </button>
        {actionError && (
          <span role="alert" className="text-sm text-red-700">
            {actionError}
          </span>
        )}
      </div>

      <UrlTable urls={batch.urls} />
    </div>
  );
}

function UrlTable({ urls }: { urls: UrlCheckResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-gray-600">
          <tr>
            <th className="p-2">URL</th>
            <th className="p-2">Status</th>
            <th className="p-2">HTTP</th>
            <th className="p-2">Time</th>
            <th className="p-2">Title</th>
            <th className="p-2">Attempts</th>
            <th className="p-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {urls.map((url) => (
            <tr key={url.id} className="border-b align-top">
              <td className="max-w-xs break-all p-2 font-mono text-xs">{url.url}</td>
              <td className="p-2">
                <StatusBadge status={url.status} />
              </td>
              <td className="p-2 tabular-nums">{url.httpStatus ?? "—"}</td>
              <td className="p-2 tabular-nums">{url.responseTimeMs === null ? "—" : `${url.responseTimeMs} ms`}</td>
              <td className="max-w-xs p-2">{url.title ?? "—"}</td>
              <td className="p-2 tabular-nums">{url.attempts}</td>
              <td className="max-w-xs p-2 text-red-700">{url.error ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
