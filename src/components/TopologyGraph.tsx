import { Panel } from "./Panel";
import { TOPOLOGY_NODES, TOPOLOGY_EDGES, type TopologyNode, type VerifiedBy } from "@/lib/topology";
import type { AlertSummary, ArgoApp, ClusterMetrics, DataResult, Health } from "@/lib/types";

const HEALTH_FILL: Record<Health, string> = {
  Healthy: "fill-emerald-500",
  Progressing: "fill-amber-500",
  Degraded: "fill-red-500",
  Suspended: "fill-neutral-400",
  Missing: "fill-red-500",
  Unknown: "fill-neutral-400",
};

const BOX_W = 168;
const BOX_H = 52;
const COL_X = [100, 320, 540, 760, 980];
const ROW_Y = [66, 154, 242, 330, 418];
const VIEWBOX_W = 1080;
const VIEWBOX_H = 470;

function pos(node: TopologyNode) {
  return { x: COL_X[node.col], y: ROW_Y[node.row] };
}

function edgeGeometry(
  from: TopologyNode,
  to: TopologyNode,
  labelT = 0.5,
): { path: string; labelX: number; labelY: number } {
  const a = pos(from);
  const b = pos(to);
  if (from.col === to.col) {
    const stubX = a.x + BOX_W / 2 + 14;
    return {
      path: `M ${a.x + BOX_W / 2} ${a.y} L ${stubX} ${a.y} L ${stubX} ${b.y} L ${b.x + BOX_W / 2} ${b.y}`,
      labelX: stubX,
      labelY: (a.y + b.y) / 2,
    };
  }
  const startX = a.x + BOX_W / 2;
  const endX = b.x - BOX_W / 2;
  return {
    path: `M ${startX} ${a.y} L ${endX} ${b.y}`,
    labelX: startX + (endX - startX) * labelT,
    labelY: a.y + (b.y - a.y) * labelT,
  };
}

export function TopologyGraph({
  apps,
  metrics,
  alerts,
}: {
  apps: DataResult<ArgoApp[]>;
  metrics: DataResult<ClusterMetrics>;
  alerts: DataResult<AlertSummary>;
}) {
  const healthByApp = new Map<string, Health>();
  if (apps.ok) {
    for (const app of apps.data) healthByApp.set(app.name, app.health);
  }

  // Live status for edges pulse exercised while rendering this very page —
  // no extra requests, just the outcome of the fetches the panels already use.
  const verifiedOk: Record<VerifiedBy, boolean> = {
    prometheus: metrics.ok,
    "k8s-api": apps.ok,
    alertmanager: alerts.ok,
  };

  const nodeById = new Map(TOPOLOGY_NODES.map((n) => [n.id, n]));

  return (
    <Panel title="Topology">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          className="min-w-[880px]"
          role="img"
          aria-label="Platform service topology"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-neutral-400 dark:fill-neutral-600" />
            </marker>
            <marker id="arrow-ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-emerald-500" />
            </marker>
            <marker id="arrow-fail" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-red-500" />
            </marker>
          </defs>

          {TOPOLOGY_EDGES.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const { path, labelX, labelY } = edgeGeometry(from, to, edge.labelT);
            const verified = edge.verifiedBy ? verifiedOk[edge.verifiedBy] : undefined;
            const stroke =
              verified === undefined
                ? "stroke-neutral-300 dark:stroke-neutral-700"
                : verified
                  ? "stroke-emerald-500/80"
                  : "stroke-red-500/80";
            const marker = verified === undefined ? "arrow" : verified ? "arrow-ok" : "arrow-fail";
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={path}
                  fill="none"
                  className={stroke}
                  strokeWidth={verified === undefined ? 1.5 : 2}
                  markerEnd={`url(#${marker})`}
                />
                <text
                  x={labelX}
                  y={labelY - 7}
                  textAnchor="middle"
                  className="fill-neutral-400 text-[11px] dark:fill-neutral-500"
                >
                  {edge.kind}
                </text>
              </g>
            );
          })}

          {TOPOLOGY_NODES.map((node) => {
            const { x, y } = pos(node);
            const health = node.argoApp ? healthByApp.get(node.argoApp) : undefined;
            const isExternal = node.kind === "external";
            const isSelf = node.kind === "self";
            return (
              <g key={node.id}>
                <rect
                  x={x - BOX_W / 2}
                  y={y - BOX_H / 2}
                  width={BOX_W}
                  height={BOX_H}
                  rx={8}
                  className={
                    isSelf
                      ? "fill-white stroke-neutral-900 dark:fill-neutral-950 dark:stroke-neutral-100"
                      : "fill-white stroke-neutral-200 dark:fill-neutral-950 dark:stroke-neutral-800"
                  }
                  strokeWidth={isSelf ? 2 : 1}
                  strokeDasharray={isExternal ? "5 4" : undefined}
                />
                {node.argoApp && (
                  <circle
                    cx={x - BOX_W / 2 + 17}
                    cy={y}
                    r={5}
                    className={HEALTH_FILL[health ?? "Unknown"]}
                  />
                )}
                <text
                  x={node.argoApp ? x + 8 : x}
                  y={y + 5}
                  textAnchor="middle"
                  className={
                    isExternal
                      ? "fill-neutral-400 text-sm italic dark:fill-neutral-500"
                      : "fill-neutral-900 text-sm dark:fill-neutral-100"
                  }
                >
                  {node.label}
                  {isSelf ? " (you are here)" : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        Edges are declared in{" "}
        <a
          href="https://github.com/yhsk9200/aporiax-pulse/blob/main/src/lib/topology.ts"
          className="underline"
        >
          topology.ts
        </a>
        ; node health is live from ArgoCD. Green edges were exercised by this page&apos;s own render
        (red = attempted and failed); the rest are declared architecture.
      </p>
    </Panel>
  );
}
