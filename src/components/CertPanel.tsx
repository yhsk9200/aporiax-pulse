import { Panel } from "./Panel";
import type { CertStatus } from "@/lib/types";

export function CertPanel({ certs }: { certs: CertStatus[] }) {
  return (
    <Panel title="TLS Certificates">
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {certs.map((cert) => (
          <li key={cert.domain} className="flex items-center justify-between py-2 text-sm">
            <span>{cert.domain}</span>
            {cert.error ? (
              <span className="text-red-500">{cert.error}</span>
            ) : (
              <span className={cert.daysRemaining !== null && cert.daysRemaining < 14 ? "text-amber-500" : "text-neutral-500"}>
                {cert.daysRemaining}d remaining
              </span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
