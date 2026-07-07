import { fetchArgoApplications } from "@/lib/k8s";
import { fetchClusterMetrics } from "@/lib/prometheus";
import { fetchCertStatuses } from "@/lib/tls";
import { AppGrid } from "@/components/AppGrid";
import { MetricPanel } from "@/components/MetricPanel";
import { CertPanel } from "@/components/CertPanel";

export const revalidate = 60;

const MONITORED_DOMAINS = ["aporiax.duckdns.org", "aporiax-auth.duckdns.org", "pulse.aporiax.duckdns.org"];

export default async function HomePage() {
  const [apps, metrics, certs] = await Promise.all([
    fetchArgoApplications(),
    fetchClusterMetrics(),
    fetchCertStatuses(MONITORED_DOMAINS),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">aporiax pulse</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Live status for the gitops-infra k3s platform — this page is served by the cluster it reports on.
        </p>
      </header>

      <MetricPanel result={metrics} />
      <AppGrid result={apps} />
      <CertPanel certs={certs} />

      <footer className="mt-auto flex gap-3 pt-8 text-xs text-neutral-500">
        <a href="https://github.com/yhsk9200/gitops-infra" className="underline">
          gitops-infra
        </a>
        <a href="https://github.com/yhsk9200/aporiax-pulse" className="underline">
          source
        </a>
      </footer>
    </main>
  );
}
