import fs from "node:fs";
import https from "node:https";
import type { ArgoApp, DataResult, DeployEvent, RevisionRef } from "./types";

const SA_DIR = "/var/run/secrets/kubernetes.io/serviceaccount";
const SHA_RE = /^[0-9a-f]{40}$/;

function readInClusterAuth(): { token: string; ca: Buffer } | null {
  try {
    const token = fs.readFileSync(`${SA_DIR}/token`, "utf8").trim();
    const ca = fs.readFileSync(`${SA_DIR}/ca.crt`);
    return { token, ca };
  } catch {
    return null;
  }
}

function k8sApiBase(): string | null {
  const host = process.env.KUBERNETES_SERVICE_HOST;
  const port = process.env.KUBERNETES_SERVICE_PORT ?? "443";
  return host ? `https://${host}:${port}` : null;
}

interface RawSource {
  repoURL: string;
}

interface RawHistoryEntry {
  revision?: string;
  revisions?: string[];
  deployedAt?: string;
}

interface RawApplication {
  metadata: { name: string; namespace: string };
  spec?: { source?: RawSource; sources?: RawSource[] };
  status?: {
    sync?: { status?: string };
    health?: { status?: string };
    history?: RawHistoryEntry[];
  };
}

// Applications CRs are read via the standard k8s API using the pod's own
// ServiceAccount token — this avoids provisioning a separate ArgoCD API
// account/token and reuses ordinary namespaced RBAC (Role+RoleBinding into
// argocd ns, get/list on applications.argoproj.io). Shared by
// fetchArgoApplications and fetchDeployEvents so both draw from one request.
async function fetchArgoApplicationsRaw(): Promise<DataResult<RawApplication[]>> {
  const auth = readInClusterAuth();
  const base = k8sApiBase();
  if (!auth || !base) {
    return { ok: false, reason: "in-cluster service account not detected (running outside k3s)" };
  }

  const url = `${base}/apis/argoproj.io/v1alpha1/namespaces/argocd/applications`;

  return new Promise((resolve) => {
    const req = https.get(
      url,
      { ca: auth.ca, headers: { Authorization: `Bearer ${auth.token}` }, timeout: 5000 },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            resolve({ ok: false, reason: `k8s API responded ${res.statusCode}` });
            return;
          }
          try {
            const parsed: { items: RawApplication[] } = JSON.parse(body);
            resolve({ ok: true, data: parsed.items });
          } catch {
            resolve({ ok: false, reason: "failed to parse Application list" });
          }
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, reason: "k8s API request timed out" });
    });
    req.on("error", (err) => resolve({ ok: false, reason: `k8s API request failed: ${err.message}` }));
  });
}

export async function fetchArgoApplications(): Promise<DataResult<ArgoApp[]>> {
  const raw = await fetchArgoApplicationsRaw();
  if (!raw.ok) return raw;
  const apps: ArgoApp[] = raw.data.map((item) => ({
    name: item.metadata.name,
    namespace: item.metadata.namespace,
    sync: (item.status?.sync?.status as ArgoApp["sync"]) ?? "Unknown",
    health: (item.status?.health?.status as ArgoApp["health"]) ?? "Unknown",
  }));
  return { ok: true, data: apps };
}

function stripGitSuffix(url: string): string {
  return url.replace(/\.git$/, "");
}

function toRevisionRef(revision: string, repoURL: string | undefined): RevisionRef {
  if (repoURL && SHA_RE.test(revision)) {
    return { display: revision.slice(0, 7), href: `${stripGitSuffix(repoURL)}/commit/${revision}` };
  }
  return { display: SHA_RE.test(revision) ? revision.slice(0, 7) : `chart ${revision}` };
}

// Multi-source Applications (e.g. a Bitnami chart + this repo's values) carry
// history[].revisions[] index-aligned with spec.sources[] instead of a single
// history[].revision — only entries that parse as a 40-char SHA get a commit
// link, chart versions render as plain text.
export async function fetchDeployEvents(): Promise<DataResult<DeployEvent[]>> {
  const raw = await fetchArgoApplicationsRaw();
  if (!raw.ok) return raw;

  const events: DeployEvent[] = [];
  for (const item of raw.data) {
    const history = item.status?.history;
    if (!history?.length) continue;
    const sources = item.spec?.sources ?? (item.spec?.source ? [item.spec.source] : []);
    for (const entry of history) {
      if (!entry.deployedAt) continue;
      const revisions: RevisionRef[] = entry.revision
        ? [toRevisionRef(entry.revision, sources[0]?.repoURL)]
        : (entry.revisions ?? []).map((rev, i) => toRevisionRef(rev, sources[i]?.repoURL));
      if (!revisions.length) continue;
      events.push({ app: item.metadata.name, deployedAt: entry.deployedAt, revisions });
    }
  }

  events.sort((a, b) => (a.deployedAt < b.deployedAt ? 1 : -1));
  return { ok: true, data: events.slice(0, 8) };
}
