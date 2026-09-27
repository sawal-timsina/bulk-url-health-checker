import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { GetBatchResponse } from "@bulk-url-checker/shared";
import { BatchView } from "@/components/batch-view";
import { ApiRequestError, apiRequest, publicApiUrl } from "@/lib/api";

interface BatchPageProps {
  params: Promise<{ id: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: BatchPageProps): Promise<Metadata> {
  const { id } = await params;

  return { title: `Batch ${id.slice(0, 8)} · Bulk URL Health Checker` };
}

/**
 * The initial state is rendered on the server from Postgres (via the API) on
 * every request, so a cold open, a shared link or a refresh mid-batch shows
 * the true state immediately. The client component then keeps it live.
 */
export default async function BatchPage({ params }: BatchPageProps) {
  await connection();

  const { id } = await params;

  if (!UUID.test(id)) {
    notFound();
  }

  let response: GetBatchResponse;

  try {
    response = await apiRequest<GetBatchResponse>(`/batches/${id}`);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-lg font-semibold">Batch {id}</h1>
      {/* key: navigating to another batch must reset client state */}
      <BatchView key={id} initialBatch={response.batch} apiUrl={publicApiUrl()} />
    </div>
  );
}
