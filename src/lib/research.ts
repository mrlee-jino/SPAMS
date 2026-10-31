import {
  hourlyMeans,
  freshness,
  type Observation,
  type DeviceNode,
  type Gateway,
  type DataSource,
} from "./dashboard.ts";
import { forecastTemperature } from "./forecast.ts";
export interface ResearchAlert {
  rule_key: string;
  title: string;
  severity: "info" | "warning" | "critical";
}
export function researchForecast(observations: Observation[], now: number) {
  const end = Math.floor(now / 3600000) * 3600000;
  const hours = hourlyMeans(
    observations.filter((o) => Date.parse(o.sampled_at) < end),
  );
  const byHour = new Map(hours.map((p) => [Date.parse(p.at), p]));
  const window = Array.from({ length: 6 }, (_, i) =>
    byHour.get(end - (6 - i) * 3600000),
  );
  if (window.some((p) => !p || p.temperature === null || p.coverage < 4))
    return null;
  const points = window.map((p) => ({
    time: p!.at,
    temperature: p!.temperature!,
  }));
  const fit = forecastTemperature(points);
  const modelErrors: number[] = [],
    baselineErrors: number[] = [];
  for (const hour of hours) {
    const at = Date.parse(hour.at);
    if (hour.temperature === null || hour.coverage < 4) continue;
    const training = Array.from({ length: 6 }, (_, i) =>
      byHour.get(at - (6 - i) * 3600000),
    );
    if (training.some((p) => !p || p.temperature === null || p.coverage < 4))
      continue;
    const inputs = training.map((p) => ({
      time: p!.at,
      temperature: p!.temperature!,
    }));
    modelErrors.push(forecastTemperature(inputs).value - hour.temperature);
    baselineErrors.push(inputs.at(-1)!.temperature - hour.temperature);
  }
  const scores = (errors: number[]) =>
    errors.length
      ? {
          mae: errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length,
          rmse: Math.sqrt(
            errors.reduce((s, e) => s + e * e, 0) / errors.length,
          ),
        }
      : null;
  return {
    target_at: new Date(end + 3600000).toISOString(),
    predicted_temperature_c: fit.value,
    model_version: "ols-hourly-six-v1",
    training_start: new Date(end - 6 * 3600000).toISOString(),
    training_end: new Date(end).toISOString(),
    valid_nodes: Math.min(...window.map((p) => p!.coverage)),
    evaluation: {
      samples: modelErrors.length,
      model: scores(modelErrors),
      persistence: scores(baselineErrors),
      scope:
        "Rolling chronological evaluation on available history; not independent field validation",
    },
  };
}
export function researchAlerts(
  nodes: DeviceNode[],
  gateways: Gateway[],
  latest: Observation[],
  now: number,
  source: DataSource,
): ResearchAlert[] {
  const result: ResearchAlert[] = [];
  const scoped = gateways.filter((g) => g.data_source === source);
  for (const g of scoped) {
    if (freshness(g.last_seen_at, now) !== "online")
      result.push({
        rule_key: `gateway:${g.id}:heartbeat`,
        title: `${g.name}: missing or stale gateway heartbeat`,
        severity: "warning",
      });
    if (
      freshness(g.last_sample_at, now) === "online" &&
      g.battery_percent !== null &&
      Number(g.battery_percent) < Number(g.min_battery_percent)
    )
      result.push({
        rule_key: `gateway:${g.id}:battery`,
        title: `${g.name}: gateway battery below configured threshold`,
        severity: "warning",
      });
  }
  for (const n of nodes.filter((n) =>
    scoped.some((g) => g.id === n.gateway_id),
  )) {
    const r = latest.find((o) => o.node_id === n.id);
    if (!r || freshness(r.sampled_at, now) !== "online") {
      result.push({
        rule_key: `node:${n.id}:heartbeat`,
        title: `${n.label}: no fresh sensor sample`,
        severity: "warning",
      });
      continue;
    }
    if (r.sensor_health !== "healthy")
      result.push({
        rule_key: `node:${n.id}:sensor`,
        title: `${n.label}: sensor reports ${r.sensor_health}`,
        severity: "warning",
      });
    const gateway = scoped.find((g) => g.id === n.gateway_id)!;
    if (
      r.sensor_health === "healthy" &&
      r.water_level_m !== null &&
      Number(r.water_level_m) < Number(gateway.min_water_level_m)
    )
      result.push({
        rule_key: `node:${n.id}:level`,
        title: `${n.label}: water level below configured minimum`,
        severity: "critical",
      });
  }
  return result;
}
