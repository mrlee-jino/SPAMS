import { timingSafeEqual } from "node:crypto";
import { deviceSupabase } from "@/lib/supabase/admin";
import { json } from "@/lib/server/http";
import { collectPages } from "@/lib/pagination";
import { researchAlerts, researchForecast } from "@/lib/research";
import type { Pond, Gateway, DeviceNode, Observation } from "@/lib/dashboard";
export const maxDuration = 60;
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32)
    return json({ error: "Research scheduler is not configured." }, 503);
  const expected = Buffer.from("Bearer " + secret);
  const supplied = Buffer.from(provided);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return json({ error: "Scheduler authentication required." }, 401);
  try {
    const client = deviceSupabase();
    const ponds = await client
      .from("ponds")
      .select("id,name")
      .limit(100)
      .returns<Pond[]>();
    if (ponds.error) throw ponds.error;
    let processed = 0;
    for (const pond of ponds.data) {
      const gateways = await client
        .from("gateways")
        .select("*")
        .eq("pond_id", pond.id)
        .returns<Gateway[]>();
      if (gateways.error) throw gateways.error;
      const gatewayIds = gateways.data.map((g) => g.id);
      if (!gatewayIds.length) continue;
      const nodes = await client
        .from("nodes")
        .select("*")
        .in("gateway_id", gatewayIds)
        .returns<DeviceNode[]>();
      if (nodes.error) throw nodes.error;
      const ids = nodes.data.map((n) => n.id);
      if (!ids.length) continue;
      const now = Date.now(),
        cutoff = new Date(now - 86400000).toISOString(),
        until = new Date(now).toISOString();
      const observations = await collectPages<Observation>(async (after) => {
        let query = client
          .from("node_telemetry")
          .select("*")
          .in("node_id", ids)
          .gte("sampled_at", cutoff)
          .lte("sampled_at", until)
          .order("id")
          .limit(1000);
        if (after) query = query.gt("id", after);
        const result = await query.returns<Observation[]>();
        if (result.error) throw result.error;
        return result.data;
      });
      const latest = await Promise.all(
        ids.map(async (id) => {
          const r = await client
            .from("node_telemetry")
            .select("*")
            .eq("node_id", id)
            .order("sampled_at", { ascending: false })
            .limit(1)
            .returns<Observation[]>();
          if (r.error) throw r.error;
          return r.data;
        }),
      );
      for (const source of ["hardware", "simulation"] as const) {
        if (!gateways.data.some((g) => g.data_source === source)) continue;
        const forecast = researchForecast(
          observations.filter((o) => o.source === source),
          now,
        );
        const alerts = researchAlerts(
          nodes.data,
          gateways.data,
          latest.flat(),
          now,
          source,
        );
        const publish = await client.rpc("publish_research", {
          p_pond: pond.id,
          p_source: source,
          p_forecast: forecast,
          p_alerts: alerts,
        });
        if (publish.error) throw publish.error;
        processed++;
      }
    }
    return json({ processed, completedAt: new Date().toISOString() });
  } catch {
    return json(
      {
        error:
          "Research processing failed. Check migrations, network access and the processing budget. Existing results were retained.",
      },
      503,
    );
  }
}
export const POST = run;
export const GET = run;
