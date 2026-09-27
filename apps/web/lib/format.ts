import type { BatchStatus, UrlCheckStatus } from "@bulk-url-checker/shared";

export const statusClasses: Record<BatchStatus | UrlCheckStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  queued: "bg-gray-100 text-gray-700",
  running: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  success: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-yellow-100 text-yellow-800",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }) + " UTC";
}
