import type { AlertSummary, DataResult } from "@/lib/types";

export function AlertChip({ result }: { result: DataResult<AlertSummary> }) {
  if (!result.ok) {
    return (
      <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        alerts: unavailable
      </span>
    );
  }

  const { total, bySeverity } = result.data;
  const critical = bySeverity["critical"] ?? 0;
  const color =
    total === 0
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : critical > 0
        ? "bg-red-500/10 text-red-600 dark:text-red-400"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${color}`}>
      {total} active alert{total === 1 ? "" : "s"}
    </span>
  );
}
