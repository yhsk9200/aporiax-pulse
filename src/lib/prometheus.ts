import type { ClusterMetrics, DataResult } from "./types";

const PROM_URL = process.env.PROMETHEUS_URL;

async function promQuery(query: string): Promise<number | null> {
  const res = await fetch(`${PROM_URL}/api/v1/query?query=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`prometheus responded ${res.status}`);
  const json = await res.json();
  const value = json?.data?.result?.[0]?.value?.[1];
  return value !== undefined ? Number(value) : null;
}

export async function fetchClusterMetrics(): Promise<DataResult<ClusterMetrics>> {
  if (!PROM_URL) {
    return { ok: false, reason: "PROMETHEUS_URL not configured (running outside cluster)" };
  }
  try {
    const [cpuPercent, memPercent, uptimeSeconds] = await Promise.all([
      promQuery('100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))'),
      promQuery("100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)"),
      promQuery("node_time_seconds - node_boot_time_seconds"),
    ]);
    return {
      ok: true,
      data: {
        cpuPercent: cpuPercent ?? 0,
        memPercent: memPercent ?? 0,
        uptimeSeconds: uptimeSeconds ?? 0,
      },
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "prometheus query failed" };
  }
}
