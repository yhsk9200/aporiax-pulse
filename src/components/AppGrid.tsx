import { Panel } from "./Panel";
import type { ArgoApp, DataResult, Health } from "@/lib/types";

const HEALTH_COLOR: Record<Health, string> = {
  Healthy: "bg-emerald-500",
  Progressing: "bg-amber-500",
  Degraded: "bg-red-500",
  Suspended: "bg-neutral-400",
  Missing: "bg-red-500",
  Unknown: "bg-neutral-400",
};

export function AppGrid({ result }: { result: DataResult<ArgoApp[]> }) {
  return (
    <Panel
      title={`ArgoCD Applications${result.ok ? ` (${result.data.length})` : ""}`}
      unavailableReason={result.ok ? undefined : result.reason}
    >
      {result.ok && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {result.data.map((app) => (
            <li
              key={app.name}
              className="flex items-center gap-2 rounded border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_COLOR[app.health]}`} />
              <span className="truncate">{app.name}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
