"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-gray-600">{error.digest ? `Error ${error.digest}` : error.message}</p>
      <button type="button" onClick={reset} className="self-start rounded border px-3 py-1 text-sm">
        Try again
      </button>
    </div>
  );
}
