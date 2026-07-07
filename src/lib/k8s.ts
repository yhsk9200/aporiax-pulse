import fs from "node:fs";
import https from "node:https";
import type { ArgoApp, DataResult } from "./types";

const SA_DIR = "/var/run/secrets/kubernetes.io/serviceaccount";

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

interface RawApplication {
  metadata: { name: string; namespace: string };
  status?: { sync?: { status?: string }; health?: { status?: string } };
}

// Applications CRs are read via the standard k8s API using the pod's own
// ServiceAccount token — this avoids provisioning a separate ArgoCD API
// account/token and reuses ordinary namespaced RBAC (Role+RoleBinding into
// argocd ns, get/list on applications.argoproj.io).
export async function fetchArgoApplications(): Promise<DataResult<ArgoApp[]>> {
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
            const apps: ArgoApp[] = parsed.items.map((item) => ({
              name: item.metadata.name,
              namespace: item.metadata.namespace,
              sync: (item.status?.sync?.status as ArgoApp["sync"]) ?? "Unknown",
              health: (item.status?.health?.status as ArgoApp["health"]) ?? "Unknown",
            }));
            resolve({ ok: true, data: apps });
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
