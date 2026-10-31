export interface Pond {
  id: string;
  name: string;
}
export type DataSource = "hardware" | "simulation";
export interface Gateway {
  data_source: DataSource;
  id: string;
  pond_id: string;
  name: string;
  control_enabled: boolean;
  last_seen_at: string | null;
  last_sample_at: string | null;
  battery_percent: number | null;
  voltage: number | null;
  charging: boolean | null;
  solar_watts: number | null;
  solar_voltage: number | null;
  pump_state: "on" | "off" | "unknown";
  min_water_level_m: number;
  min_battery_percent: number;
}
export interface DeviceNode {
  id: string;
  gateway_id: string;
  label: string;
  position: string;
  slot: number;
  ultrasonic_enabled: boolean;
}
export interface Observation {
  source: DataSource;
  id: string;
  node_id: string;
  sampled_at: string;
  received_at: string;
  temperature_c: number | null;
  water_level_m: number | null;
  battery_percent: number | null;
  sensor_health: "healthy" | "degraded" | "failed";
}
export interface AcousticSample {
  id: string;
  telemetry_id: string;
  echo_us: number;
  amplitude: number;
  valid_returns: number;
  quality: "usable" | "noisy" | "invalid";
}
export type CommandStatus =
  | "pending"
  | "delivered"
  | "acknowledged"
  | "completed"
  | "rejected"
  | "expired";
export interface PumpCommand {
  id: string;
  gateway_id: string;
  requested_by: string;
  action: "start" | "stop";
  status: CommandStatus;
  requested_at: string;
  expires_at: string;
  updated_at: string;
}
export interface CommandEvent {
  id: string;
  command_id: string;
  event: string;
  created_at: string;
  detail: string | null;
}
export interface PondAlert {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  opened_at: string;
  resolved_at: string | null;
}
export interface StoredForecast {
  evaluation?: {
    samples: number;
    model: { mae: number; rmse: number } | null;
    persistence: { mae: number; rmse: number } | null;
    scope: string;
  };
  source: DataSource;
  id: string;
  target_at: string;
  generated_at: string;
  predicted_temperature_c: number;
  model_version: string;
  training_start: string;
  training_end: string;
  valid_nodes: number;
}
export interface DashboardSnapshot {
  ponds: Pond[];
  pond: Pond | null;
  gateways: Gateway[];
  gateway: Gateway | null;
  nodes: DeviceNode[];
  latest: Observation[];
  history: Observation[];
  historyTruncated: boolean;
  acoustics: AcousticSample[];
  commands: PumpCommand[];
  events: CommandEvent[];
  alerts: PondAlert[];
  forecast: StoredForecast | null;
  fetchedAt: string;
}
export function freshness(
  timestamp: string | null,
  now: number,
): "online" | "stale" | "offline" {
  if (!timestamp) return "offline";
  const age = now - Date.parse(timestamp);
  if (!Number.isFinite(age) || age > 15 * 60000) return "offline";
  return age > 90 * 1000 ? "stale" : "online";
}
export function ageLabel(timestamp: string | null, now: number) {
  if (!timestamp) return "No readings";
  const seconds = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000));
  return seconds < 60
    ? `${seconds}s ago`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : `${Math.floor(seconds / 3600)}h ago`;
}
/** Equal node weighting per hour, never sample-count weighting. No gap filling. */
export function hourlyMeans(observations: readonly Observation[]) {
  const hours = new Map<string, Map<string, { t: number[]; l: number[] }>>();
  for (const o of observations) {
    if (o.sensor_health !== "healthy") continue;
    const date = new Date(o.sampled_at);
    date.setUTCMinutes(0, 0, 0);
    const key = date.toISOString();
    if (!hours.has(key)) hours.set(key, new Map());
    const hour = hours.get(key)!;
    if (!hour.has(o.node_id)) hour.set(o.node_id, { t: [], l: [] });
    const node = hour.get(o.node_id)!;
    if (o.temperature_c !== null) node.t.push(Number(o.temperature_c));
    if (o.water_level_m !== null) node.l.push(Number(o.water_level_m));
  }
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  return [...hours]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([at, ns]) => ({
      at,
      time: new Date(at).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }),
      temperature: mean(
        [...ns.values()].filter((v) => v.t.length).map((v) => mean(v.t)!),
      ),
      level: mean(
        [...ns.values()].filter((v) => v.l.length).map((v) => mean(v.l)!),
      ),
      coverage: [...ns.values()].filter((v) => v.t.length > 0).length,
    }));
}
/** Preserve empty UTC hours as nulls so charts do not interpolate missing observations. */
export function hourlyWindow(
  observations: readonly Observation[],
  now: number,
  hours: number,
) {
  const cutoff = now - hours * 3600000;
  const points = hourlyMeans(
    observations.filter(
      (o) =>
        Date.parse(o.sampled_at) >= cutoff && Date.parse(o.sampled_at) <= now,
    ),
  );
  const byHour = new Map(points.map((p) => [p.at, p]));
  const start = Math.floor(cutoff / 3600000) * 3600000;
  const end = Math.floor(now / 3600000) * 3600000;
  return Array.from(
    { length: Math.floor((end - start) / 3600000) + 1 },
    (_, i) => {
      const at = new Date(start + i * 3600000).toISOString();
      return (
        byHour.get(at) ?? {
          at,
          time: at.slice(11, 16),
          temperature: null,
          level: null,
          coverage: 0,
        }
      );
    },
  );
}
