"use client";

import { useActionState, useState } from "react";
import { createBatchAction, type CreateBatchState } from "@/app/actions";

const initialState: CreateBatchState = { error: null, invalid: [] };

export function NewBatchForm() {
  const [state, formAction, pending] = useActionState(createBatchAction, initialState);

  // Same input → same key: a resubmit or a retried request after a network
  // blip maps to the same batch instead of creating a duplicate. Editing the
  // input is a new intent, so it gets a new key.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form
      action={formAction}
      onChange={() => setIdempotencyKey(crypto.randomUUID())}
      className="flex flex-col gap-3 rounded border p-4"
    >
      <h2 className="text-lg font-semibold">New batch</h2>

      <label className="flex flex-col gap-1 text-sm">
        URLs (one per line)
        <textarea
          name="urls"
          rows={6}
          className="rounded border p-2 font-mono text-sm"
          placeholder={"https://example.com\nhttps://nextjs.org"}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        …or upload a CSV (first column, optional &quot;url&quot; header)
        <input type="file" name="file" accept=".csv,text/csv,text/plain" />
      </label>

      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Check URLs"}
      </button>

      {state.error && (
        <div role="alert" className="text-sm text-red-700">
          <p>{state.error}</p>
          {state.invalid.length > 0 && (
            <ul className="list-disc pl-5">
              {state.invalid.map((item) => (
                <li key={item.input}>
                  <code>{item.input}</code>: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
