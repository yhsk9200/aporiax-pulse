export type NodeKind = "cluster-service" | "control-plane" | "external" | "self";
export type EdgeKind = "ingress" | "oidc" | "db" | "query" | "read" | "alert" | "push" | "acme";

export interface TopologyNode {
  id: string;
  label: string;
  kind: NodeKind;
  argoApp?: string; // ArgoCD Application name — binds live health. external/control-plane have none.
  col: number;
  row: number;
}

export interface TopologyEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  labelT?: number; // 0..1 position of the label along a cross-column edge (default 0.5) — used to dodge label collisions in dense regions
}

// Layout is a fixed grid (col = left-to-right tier, row = vertical slot within
// the tier) — declared here, not computed. Grafana/Prometheus/Alertmanager all
// map to the same Application because one kube-prometheus-stack release
// manages all three; sharing health is the honest representation, not a bug.
export const TOPOLOGY_NODES: TopologyNode[] = [
  { id: "internet", label: "Internet", kind: "external", col: 0, row: 2 },
  { id: "traefik", label: "Traefik", kind: "cluster-service", argoApp: "platform-system-traefik", col: 1, row: 2 },
  { id: "pulse", label: "pulse", kind: "self", argoApp: "product-pulse-web", col: 2, row: 0 },
  { id: "grafana", label: "Grafana", kind: "cluster-service", argoApp: "platform-monitoring-prometheus", col: 2, row: 1 },
  { id: "keycloak", label: "Keycloak", kind: "cluster-service", argoApp: "platform-iam-keycloak", col: 2, row: 2 },
  { id: "prometheus", label: "Prometheus", kind: "cluster-service", argoApp: "platform-monitoring-prometheus", col: 3, row: 0 },
  { id: "alertmanager", label: "Alertmanager", kind: "cluster-service", argoApp: "platform-monitoring-prometheus", col: 3, row: 1 },
  { id: "postgres", label: "PostgreSQL", kind: "cluster-service", argoApp: "platform-db-postgres", col: 3, row: 2 },
  { id: "k8s-api", label: "k8s API", kind: "control-plane", col: 3, row: 3 },
  { id: "cert-manager", label: "cert-manager", kind: "cluster-service", argoApp: "platform-system-cert-manager", col: 3, row: 4 },
  { id: "telegram", label: "Telegram", kind: "external", col: 4, row: 1 },
  { id: "letsencrypt", label: "Let's Encrypt", kind: "external", col: 4, row: 4 },
];

export const TOPOLOGY_EDGES: TopologyEdge[] = [
  { from: "internet", to: "traefik", kind: "ingress" },
  { from: "traefik", to: "pulse", kind: "ingress" },
  { from: "traefik", to: "grafana", kind: "ingress" },
  { from: "traefik", to: "keycloak", kind: "ingress" },
  { from: "pulse", to: "prometheus", kind: "query" },
  { from: "pulse", to: "k8s-api", kind: "read", labelT: 0.8 },
  { from: "grafana", to: "prometheus", kind: "query" },
  { from: "grafana", to: "keycloak", kind: "oidc" },
  { from: "keycloak", to: "postgres", kind: "db" },
  { from: "prometheus", to: "alertmanager", kind: "alert" },
  { from: "alertmanager", to: "telegram", kind: "push" },
  { from: "cert-manager", to: "letsencrypt", kind: "acme" },
];
