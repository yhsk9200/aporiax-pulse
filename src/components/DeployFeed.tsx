import { Panel } from "./Panel";
import type { DataResult, DeployEvent } from "@/lib/types";

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.floor(ms / 60_000);
  return `${Math.max(minutes, 0)}m ago`;
}

export function DeployFeed({ result }: { result: DataResult<DeployEvent[]> }) {
  return (
    <Panel title="Recent Deployments" unavailableReason={result.ok ? undefined : result.reason}>
      {result.ok && (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {result.data.map((event, i) => (
            <li
              key={`${event.app}-${event.deployedAt}-${i}`}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="w-16 shrink-0 text-neutral-500">{formatRelative(event.deployedAt)}</span>
              <span className="flex-1 truncate">{event.app}</span>
              <span className="flex shrink-0 gap-2 text-xs">
                {event.revisions.map((rev, j) =>
                  rev.href ? (
                    <a key={j} href={rev.href} className="underline">
                      {rev.display}
                    </a>
                  ) : (
                    <span key={j} className="text-neutral-400">
                      {rev.display}
                    </span>
                  ),
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
