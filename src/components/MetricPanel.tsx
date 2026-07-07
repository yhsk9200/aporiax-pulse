import { Panel } from "./Panel";
import type { ClusterMetrics, DataResult } from "@/lib/types";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function Gauge({ label, percent }: { label: string; percent: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-500">
        <span>{label}</span>
        <span>{percent.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

export function MetricPanel({ result }: { result: DataResult<ClusterMetrics> }) {
  return (
    <Panel title="Node" unavailableReason={result.ok ? undefined : result.reason}>
      {result.ok && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Gauge label="CPU" percent={result.data.cpuPercent} />
          <Gauge label="Memory" percent={result.data.memPercent} />
          <div>
            <div className="text-xs text-neutral-500">Uptime</div>
            <div className="mt-1 text-sm">{formatUptime(result.data.uptimeSeconds)}</div>
          </div>
        </div>
      )}
    </Panel>
  );
}
