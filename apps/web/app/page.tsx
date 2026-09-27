import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { ListBatchesResponse } from "@bulk-url-checker/shared";
import { NewBatchForm } from "@/components/new-batch-form";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Server Component: the list is fetched on the server on every request (no
 * Next cache). The API serves it from its 30s Redis cache, which is
 * invalidated whenever a batch is created or changes status.
 */
async function BatchList() {
  // Request-time only: never prerender batch data at build time.
  await connection();

  const { batches } = await apiRequest<ListBatchesResponse>("/batches");

  if (batches.length === 0) {
    return <p className="text-sm text-gray-600">No batches yet.</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b text-gray-600">
        <tr>
          <th className="p-2">Batch</th>
          <th className="p-2">Status</th>
          <th className="p-2">Progress</th>
          <th className="p-2">Created</th>
        </tr>
      </thead>
      <tbody>
        {batches.map((batch) => (
          <tr key={batch.id} className="border-b">
            <td className="p-2 font-mono text-xs">
              <Link href={`/batches/${batch.id}`} className="text-blue-700 underline">
                {batch.id}
              </Link>
            </td>
            <td className="p-2">
              <StatusBadge status={batch.status} />
            </td>
            <td className="p-2">
              <ProgressBar done={batch.completedCount} total={batch.totalCount} />
            </td>
            <td className="p-2">{formatDate(batch.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <NewBatchForm />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Batches</h2>
        <Suspense fallback={<p className="text-sm text-gray-600">Loading batches…</p>}>
          <BatchList />
        </Suspense>
      </section>
    </div>
  );
}
