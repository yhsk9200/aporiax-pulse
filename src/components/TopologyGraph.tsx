import { Panel } from "./Panel";
import { TOPOLOGY_NODES, TOPOLOGY_EDGES, type TopologyNode } from "@/lib/topology";
import type { ArgoApp, DataResult, Health } from "@/lib/types";

const HEALTH_FILL: Record<Health, string> = {
  Healthy: "fill-emerald-500",
  Progressing: "fill-amber-500",
  Degraded: "fill-red-500",
  Suspended: "fill-neutral-400",
  Missing: "fill-red-500",
  Unknown: "fill-neutral-400",
};

const BOX_W = 140;
const BOX_H = 40;
const COL_X = [80, 280, 480, 680, 880];
const ROW_Y = [60, 140, 220, 300, 380];
const VIEWBOX_W = 960;
const VIEWBOX_H = 420;

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

export function TopologyGraph({ result }: { result: DataResult<ArgoApp[]> }) {
  const healthByApp = new Map<string, Health>();
  if (result.ok) {
    for (const app of result.data) healthByApp.set(app.name, app.health);
  }

  const nodeById = new Map(TOPOLOGY_NODES.map((n) => [n.id, n]));

  return (
    <Panel title="Topology">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          className="min-w-[720px]"
          role="img"
          aria-label="Platform service topology"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-neutral-400 dark:fill-neutral-600" />
            </marker>
          </defs>

          {TOPOLOGY_EDGES.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const { path, labelX, labelY } = edgeGeometry(from, to, edge.labelT);
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={path}
                  fill="none"
                  className="stroke-neutral-300 dark:stroke-neutral-700"
                  strokeWidth={1.5}
                  markerEnd="url(#arrow)"
                />
                <text
                  x={labelX}
                  y={labelY - 6}
                  textAnchor="middle"
                  className="fill-neutral-400 text-[10px] dark:fill-neutral-500"
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
                  rx={6}
                  className={
                    isSelf
                      ? "fill-white stroke-neutral-900 dark:fill-neutral-950 dark:stroke-neutral-100"
                      : "fill-white stroke-neutral-200 dark:fill-neutral-950 dark:stroke-neutral-800"
                  }
                  strokeWidth={isSelf ? 2 : 1}
                  strokeDasharray={isExternal ? "4 3" : undefined}
                />
                {node.argoApp && (
                  <circle
                    cx={x - BOX_W / 2 + 14}
                    cy={y}
                    r={4}
                    className={HEALTH_FILL[health ?? "Unknown"]}
                  />
                )}
                <text
                  x={node.argoApp ? x + 6 : x}
                  y={y + 4}
                  textAnchor="middle"
                  className={
                    isExternal
                      ? "fill-neutral-400 text-xs italic dark:fill-neutral-500"
                      : "fill-neutral-900 text-xs dark:fill-neutral-100"
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
        ; node health is live from ArgoCD.
      </p>
    </Panel>
  );
}
