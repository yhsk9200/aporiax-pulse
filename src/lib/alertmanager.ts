import type { AlertSummary, DataResult } from "./types";

const ALERTMANAGER_URL = process.env.ALERTMANAGER_URL;

interface RawAlert {
  labels?: { alertname?: string; severity?: string };
}

// Meta-alerts exist to drive the alerting machinery, not to report platform
// state: Watchdog fires permanently (pipeline liveness check) and
// InfoInhibitor fires whenever any severity=info alert exists purely to
// inhibit its notifications. Counting either would show a false positive on
// a public page, so both are excluded here rather than left for the UI to
// filter. (InfoInhibitor was caught by live verification — it fired off a
// CPUThrottlingHigh info alert during this feature's own rollout.)
const META_ALERTS = new Set(["Watchdog", "InfoInhibitor"]);

export async function fetchAlertSummary(): Promise<DataResult<AlertSummary>> {
  if (!ALERTMANAGER_URL) {
    return { ok: false, reason: "ALERTMANAGER_URL not configured (running outside cluster)" };
  }
  try {
    const res = await fetch(`${ALERTMANAGER_URL}/api/v2/alerts?active=true&silenced=false&inhibited=false`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`alertmanager responded ${res.status}`);
    const alerts: RawAlert[] = await res.json();
    const bySeverity: Record<string, number> = {};
    let total = 0;
    for (const alert of alerts) {
      if (META_ALERTS.has(alert.labels?.alertname ?? "")) continue;
      const severity = alert.labels?.severity ?? "unknown";
      bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;
      total += 1;
    }
    return { ok: true, data: { total, bySeverity } };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "alertmanager query failed" };
  }
}
