import { Registry, collectDefaultMetrics } from "prom-client";

export const dynamic = "force-dynamic";

const registry = new Registry();
collectDefaultMetrics({ register: registry });

export async function GET() {
  const body = await registry.metrics();
  return new Response(body, { headers: { "Content-Type": registry.contentType } });
}
