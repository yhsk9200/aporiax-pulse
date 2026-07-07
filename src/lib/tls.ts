import tls from "node:tls";
import type { CertStatus } from "./types";

function checkOne(domain: string): Promise<CertStatus> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: domain, port: 443, servername: domain, timeout: 5000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert?.valid_to) {
        resolve({ domain, daysRemaining: null, validTo: null, error: "no certificate returned" });
        return;
      }
      const validTo = new Date(cert.valid_to);
      const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);
      resolve({ domain, daysRemaining, validTo: validTo.toISOString() });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ domain, daysRemaining: null, validTo: null, error: "TLS handshake timed out" });
    });
    socket.on("error", (err) => {
      resolve({ domain, daysRemaining: null, validTo: null, error: err.message });
    });
  });
}

// Handshakes directly against each domain rather than reading cert-manager
// Secrets — this works identically in-cluster and from a laptop, and is the
// one panel that stays fully live during local dev.
export async function fetchCertStatuses(domains: string[]): Promise<CertStatus[]> {
  return Promise.all(domains.map(checkOne));
}
