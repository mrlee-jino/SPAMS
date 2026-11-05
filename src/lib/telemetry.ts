export interface AcousticReading {
  echo_us: number;
  amplitude: number;
  valid_returns: number;
  quality: "usable" | "noisy" | "invalid";
}

export interface NodeReading {
  node_id: string;
  boot_id: string;
  sequence: number;
  sampled_at: string;

  temperature_c: number | null;
  water_level_m: number | null;
  battery_percent: number | null;

  // Additional SPAMS water-quality sensors
  ph_value: number | null;
  tds_ppm: number | null;
  turbidity_voltage: number | null;
  turbidity_ntu: number | null;
  water_level_raw: number | null;

  sensor_health: "healthy" | "degraded" | "failed";
  acoustic?: AcousticReading;
}

export interface TelemetryPacket {
  gateway: {
    boot_id: string;
    sequence: number;
    sampled_at: string;
    battery_percent: number | null;
    voltage: number | null;
    charging: boolean | null;
    solar_watts: number | null;
    solar_voltage: number | null;
    pump_state: "on" | "off" | "unknown";
  };
  nodes: NodeReading[];
}
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Invalid object");
  return v as Record<string, unknown>;
}
function numeric(
  v: unknown,
  min: number,
  max: number,
  nullable = false,
): number | null {
  if (nullable && v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error("Invalid measurement");
  return v;
}
function choice<T extends string>(v: unknown, values: readonly T[]): T {
  if (typeof v !== "string" || !values.includes(v as T))
    throw new Error("Invalid state");
  return v as T;
}
function identity(r: Record<string, unknown>, now: number) {
  if (
    !isUuid(r.boot_id) ||
    !Number.isSafeInteger(r.sequence) ||
    Number(r.sequence) < 0
  )
    throw new Error("Invalid sequence identity");
  if (
    typeof r.sampled_at !== "string" ||
    !Number.isFinite(Date.parse(r.sampled_at)) ||
    Date.parse(r.sampled_at) < now - 86400000 ||
    Date.parse(r.sampled_at) > now + 60000
  )
    throw new Error("Sample timestamp out of range");
  return {
    boot_id: r.boot_id,
    sequence: Number(r.sequence),
    sampled_at: new Date(r.sampled_at).toISOString(),
  };
}
export function parseTelemetry(
  input: unknown,
  now = Date.now(),
): TelemetryPacket {
  const packet = record(input),
    g = record(packet.gateway);
  if (!Array.isArray(packet.nodes) || packet.nodes.length > 6)
    throw new Error("At most six nodes are supported");
  const gateway = {
    ...identity(g, now),
    battery_percent: numeric(g.battery_percent, 0, 100, true),
    voltage: numeric(g.voltage, 0, 100, true),
    charging: g.charging as boolean | null,
    solar_watts: numeric(g.solar_watts, 0, 10000, true),
    solar_voltage: numeric(g.solar_voltage, 0, 100, true),
    pump_state: choice(g.pump_state, ["on", "off", "unknown"] as const),
  };
  if (g.charging !== null && typeof g.charging !== "boolean")
    throw new Error("Invalid charging state");
  const seen = new Set<string>();
  const nodes = packet.nodes.map((input): NodeReading => {
    const n = record(input);
    if (!isUuid(n.node_id) || seen.has(n.node_id))
      throw new Error("Invalid or duplicate node");
    seen.add(n.node_id);
    
  const result: NodeReading = {
    ...identity(n, now),

    node_id: n.node_id,

    temperature_c: numeric(
      n.temperature_c, -10, 60, true
    ),

    water_level_m: numeric(
      n.water_level_m, 0, 20, true
    ),

    battery_percent: numeric(
      n.battery_percent, 0, 100, true
    ),

    ph_value: numeric(
      n.ph_value ?? null, 0, 14, true
    ),

    tds_ppm: numeric(
      n.tds_ppm ?? null, 0, 100000, true
    ),

    turbidity_voltage: numeric(
      n.turbidity_voltage ?? null, 0, 6, true
    ),

    turbidity_ntu: numeric(
      n.turbidity_ntu ?? null, 0, 100000, true
    ),

    water_level_raw: numeric(
      n.water_level_raw ?? null, 0, 4095, true
    ),

    sensor_health: choice(n.sensor_health, [
      "healthy",
      "degraded",
      "failed",
    ] as const),
  };

  if (
    result.water_level_raw !== null &&
    !Number.isInteger(result.water_level_raw)
  ) {
    throw new Error("Invalid water level ADC value");
  }

    return result;
  });
  return { gateway, nodes };
}
