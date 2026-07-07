export type DataResult<T> = { ok: true; data: T } | { ok: false; reason: string };

export type Sync = "Synced" | "OutOfSync" | "Unknown";
export type Health = "Healthy" | "Progressing" | "Degraded" | "Suspended" | "Missing" | "Unknown";

export interface ArgoApp {
  name: string;
  namespace: string;
  sync: Sync;
  health: Health;
}

export interface ClusterMetrics {
  cpuPercent: number;
  memPercent: number;
  uptimeSeconds: number;
}

export interface CertStatus {
  domain: string;
  daysRemaining: number | null;
  validTo: string | null;
  error?: string;
}
