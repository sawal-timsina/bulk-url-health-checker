export function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-40 overflow-hidden rounded bg-gray-200"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}
