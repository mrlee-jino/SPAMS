import { publicClient, json } from "@/lib/server/http";
import { isUuid } from "@/lib/telemetry";
import type { Observation } from "@/lib/dashboard";
/** Keyset pagination: never silently truncates exports at the dashboard history cap. */
export async function GET(request: Request) {
  const auth = publicClient();
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const gateway = params.get("gateway");
  const after = params.get("after");
  const start = params.get("start"),
    end = params.get("end");
  const snapshot = params.get("snapshot") ?? new Date().toISOString();
  const times = [start, end, snapshot].map((v) => (v ? Date.parse(v) : NaN));
  if (
    !isUuid(gateway) ||
    (after && !isUuid(after)) ||
    times.some((t) => !Number.isFinite(t)) ||
    times[1] <= times[0] ||
    times[1] - times[0] > 31 * 86400000 ||
    times[2] > Date.now() + 60000
  )
    return json(
      { error: "Provide a valid gateway and date range of at most 31 days." },
      400,
    );
  const nodes = await auth.client
    .from("nodes")
    .select("id")
    .eq("gateway_id", gateway);
  if (nodes.error) return json({ error: "Export query unavailable." }, 503);
  const ids = (nodes.data ?? []).map((n) => n.id as string);
  if (!ids.length) return json({ rows: [], next: null, snapshot });
  let query = auth.client
    .from("node_telemetry")
    .select(
      "id,node_id,sampled_at,received_at,temperature_c,water_level_m,battery_percent,sensor_health,source",
    )
    .in("node_id", ids)
    .gte("sampled_at", new Date(times[0]).toISOString())
    .lt("sampled_at", new Date(times[1]).toISOString())
    .lte("received_at", new Date(times[2]).toISOString())
    .order("id")
    .limit(1000);
  if (after) query = query.gt("id", after);
  const result = await query.returns<Observation[]>();
  if (result.error) return json({ error: "Export query failed." }, 503);
  return json({
    rows: result.data,
    next: result.data.length === 1000 ? result.data.at(-1)!.id : null,
    snapshot,
  });
}
