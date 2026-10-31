import { json, publicClient } from "@/lib/server/http";
import { isUuid } from "@/lib/telemetry";
import type {
  Pond,
  Gateway,
  DeviceNode,
  Observation,
  AcousticSample,
  PondAlert,
  StoredForecast,
  DashboardSnapshot,
} from "@/lib/dashboard";
export async function GET(request: Request) {
  const auth = publicClient();
  if (auth.error) return auth.error;
  const client = auth.client;
  const query = new URL(request.url).searchParams;
  const pondId = query.get("pond");
  const gatewayId = query.get("gateway");
  if ((pondId && !isUuid(pondId)) || (gatewayId && !isUuid(gatewayId)))
    return json({ error: "Invalid workspace identifier." }, 400);
  const pondsResult = await client
    .from("ponds")
    .select("id,name")
    .eq("is_public", true)
    .order("created_at")
    .limit(100)
    .returns<Pond[]>();
  if (pondsResult.error)
    return json(
      {
        error: "Database unavailable. Confirm Phase 2 migrations are applied.",
      },
      503,
    );
  const ponds = pondsResult.data;
  const pond = pondId ? ponds.find((p) => p.id === pondId) : ponds[0];
  if (pondId && !pond)
    return json({ error: "Pond not available for public monitoring." }, 403);
  const base: DashboardSnapshot = {
    ponds,
    pond: pond ?? null,
    gateways: [],
    gateway: null,
    nodes: [],
    latest: [],
    history: [],
    historyTruncated: false,
    acoustics: [],
    commands: [],
    events: [],
    alerts: [],
    forecast: null,
    fetchedAt: new Date().toISOString(),
  };
  if (!pond) return json(base);
  const gatewaysResult = await client
    .from("gateways")
    .select("*")
    .eq("pond_id", pond.id)
    .order("name")
    .limit(100)
    .returns<Gateway[]>();
  if (gatewaysResult.error)
    return json({ error: "Gateway query failed." }, 503);
  base.gateways = gatewaysResult.data;
  base.gateway =
    (gatewayId
      ? base.gateways.find((g) => g.id === gatewayId)
      : base.gateways[0]) ?? null;
  if (gatewayId && !base.gateway)
    return json({ error: "Gateway not available in this pond." }, 403);
  const [alerts, forecast] = await Promise.all([
    client
      .from("alerts")
      .select("*")
      .eq("pond_id", pond.id)
      .eq("source", base.gateway?.data_source ?? "hardware")
      .order("opened_at", { ascending: false })
      .limit(100)
      .returns<PondAlert[]>(),
    client
      .from("forecasts")
      .select("*")
      .eq("pond_id", pond.id)
      .eq("source", base.gateway?.data_source ?? "hardware")
      .order("generated_at", { ascending: false })
      .limit(1)
      .returns<StoredForecast[]>(),
  ]);
  if (alerts.error || forecast.error)
    return json({ error: "Pond records could not be loaded." }, 503);
  base.alerts = alerts.data;
  base.forecast = forecast.data[0] ?? null;
  if (!base.gateway) return json(base);
  const nodeResult = await client
    .from("nodes")
    .select("*")
    .eq("gateway_id", base.gateway.id)
    .order("slot")
    .returns<DeviceNode[]>();
  if (nodeResult.error) return json({ error: "Node query failed." }, 503);
  base.nodes = nodeResult.data;
  const ids = base.nodes.map((n) => n.id);
  const [history, ...latest] = await Promise.all([
    ids.length
      ? client
          .from("node_telemetry")
          .select("*", { count: "exact" })
          .in("node_id", ids)
          .gte("sampled_at", new Date(Date.now() - 86400000).toISOString())
          .order("sampled_at", { ascending: false })
          .limit(1000)
          .returns<Observation[]>()
      : Promise.resolve({ data: [], error: null, count: 0 }),
    ...ids.map((id) =>
      client
        .from("node_telemetry")
        .select("*")
        .eq("node_id", id)
        .order("sampled_at", { ascending: false })
        .limit(1)
        .returns<Observation[]>(),
    ),
  ]);
  if (history.error || latest.some((r) => r.error))
    return json({ error: "Telemetry records could not be loaded." }, 503);
  base.history = history.data ?? [];
  base.historyTruncated = (history.count ?? 0) > base.history.length;
  base.latest = latest.flatMap((r) => r.data ?? []);
  if (base.latest.length) {
    const acoustics = await client
      .from("acoustic_samples")
      .select("*")
      .in(
        "telemetry_id",
        base.latest.map((t) => t.id),
      )
      .returns<AcousticSample[]>();
    if (acoustics.error)
      return json({ error: "Acoustic records could not be loaded." }, 503);
    base.acoustics = acoustics.data ?? [];
  }
  return json(base);
}
