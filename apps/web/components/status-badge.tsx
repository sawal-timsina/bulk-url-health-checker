import type { BatchStatus, UrlCheckStatus } from "@bulk-url-checker/shared";
import { statusClasses } from "@/lib/format";

export function StatusBadge({ status }: { status: BatchStatus | UrlCheckStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClasses[status]}`}>{status}</span>;
}
