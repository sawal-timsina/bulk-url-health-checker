"use server";

import { redirect } from "next/navigation";
import type {
  BatchActionRequest,
  BatchActionResponse,
  BatchDetails,
  CreateBatchRequest,
  CreateBatchResponse,
  GetBatchResponse,
} from "@bulk-url-checker/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { parseUrlList } from "@/lib/parse-urls";

export interface CreateBatchState {
  error: string | null;
  invalid: Array<{ input: string; reason: string }>;
}

// FormData values are string | File; only accept the string form.
function formText(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

export async function createBatchAction(_prev: CreateBatchState, formData: FormData): Promise<CreateBatchState> {
  const pasted = formText(formData, "urls");
  const file = formData.get("file");
  const csv = file instanceof File && file.size > 0 ? await file.text() : "";

  const urls = [...parseUrlList(pasted), ...parseUrlList(csv)];

  if (urls.length === 0) {
    return { error: "Paste at least one URL or upload a CSV.", invalid: [] };
  }

  let batchId: string;

  try {
    const body: CreateBatchRequest = { urls };
    const idempotencyKey = formText(formData, "idempotencyKey");

    const { batch } = await apiRequest<CreateBatchResponse>("/batches", {
      method: "POST",
      body: JSON.stringify(body),
      headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : {},
    });

    batchId = batch.id;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 400) {
      const invalid = Array.isArray(error.body?.details) ? (error.body.details as CreateBatchState["invalid"]) : [];

      return { error: error.message, invalid };
    }

    throw error;
  }

  // Outside try/catch: redirect() works by throwing.
  redirect(`/batches/${batchId}`);
}

export type BatchActionResult = { ok: true; batch: BatchDetails } | { ok: false; error: string };

async function runBatchAction(batchId: string, action: "cancel" | "retry-failed"): Promise<BatchActionResult> {
  try {
    const body: BatchActionRequest = { id: batchId };

    await apiRequest<BatchActionResponse>(`/batches/${action}`, { method: "POST", body: JSON.stringify(body) });

    const { batch } = await apiRequest<GetBatchResponse>(`/batches/${batchId}`);

    return { ok: true, batch };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status < 500) {
      return { ok: false, error: error.message };
    }

    throw error;
  }
}

export async function cancelBatchAction(batchId: string) {
  return runBatchAction(batchId, "cancel");
}

export async function retryFailedAction(batchId: string) {
  return runBatchAction(batchId, "retry-failed");
}
