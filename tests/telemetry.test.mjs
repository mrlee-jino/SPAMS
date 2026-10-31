import test from "node:test";
import assert from "node:assert/strict";
import { parseTelemetry } from "../src/lib/telemetry.ts";
import { freshness, hourlyMeans } from "../src/lib/dashboard.ts";
const now = Date.parse("2026-10-31T10:00:00Z");
const id = "11111111-1111-4111-8111-111111111111";
function packet() {
  return {
    gateway: {
      boot_id: id,
      sequence: 1,
      sampled_at: new Date(now).toISOString(),
      battery_percent: 80,
      voltage: 12.8,
      charging: false,
      solar_watts: null,
      solar_voltage: null,
      pump_state: "unknown",
    },
    nodes: [
      {
        node_id: id,
        boot_id: id,
        sequence: 1,
        sampled_at: new Date(now).toISOString(),
        temperature_c: 28,
        water_level_m: 1.2,
        battery_percent: 90,
        sensor_health: "healthy",
      },
    ],
  };
}
test("validates nullable sensors, optional acoustic data and strips extra fields", () => {
  const input = packet();
  input.nodes[0].temperature_c = null;
  input.nodes[0].acoustic = {
    echo_us: 1400,
    amplitude: 0.4,
    valid_returns: 95,
    quality: "usable",
  };
  input.gateway.extra = "ignored";
  const result = parseTelemetry(input, now);
  assert.equal(result.nodes[0].temperature_c, null);
  assert.equal(result.nodes[0].acoustic.quality, "usable");
  assert.equal("extra" in result.gateway, false);
});
test("rejects invalid ranges, duplicate nodes, timestamp replay windows and non-finite data", () => {
  for (const change of [
    (p) => (p.gateway.battery_percent = 101),
    (p) => (p.gateway.voltage = NaN),
    (p) => p.nodes.push({ ...p.nodes[0] }),
    (p) => (p.nodes[0].sampled_at = "invalid"),
    (p) => (p.gateway.sampled_at = "2026-10-29T00:00:00Z"),
    (p) => (p.gateway.sampled_at = "2026-11-01T00:00:00Z"),
    (p) => (p.nodes[0].water_level_m = -1),
    (p) => (p.gateway.sequence = 1.5),
    (p) =>
      (p.nodes[0].acoustic = {
        echo_us: 1,
        amplitude: 0.4,
        valid_returns: 2.5,
        quality: "usable",
      }),
  ]) {
    const p = packet();
    change(p);
    assert.throws(() => parseTelemetry(p, now));
  }
});
test("freshness distinguishes missing, fresh, stale and offline observations", () => {
  assert.equal(freshness(null, now), "offline");
  assert.equal(freshness(new Date(now - 1000).toISOString(), now), "online");
  assert.equal(freshness(new Date(now - 120000).toISOString(), now), "stale");
  assert.equal(
    freshness(new Date(now - 16 * 60000).toISOString(), now),
    "offline",
  );
});
test("hourly means weight nodes equally and exclude failed readings", () => {
  const readings = [
    { node_id: "A", temperature_c: 20, water_level_m: 1 },
    { node_id: "A", temperature_c: 22, water_level_m: 1 },
    { node_id: "B", temperature_c: 29, water_level_m: 2 },
    {
      node_id: "C",
      temperature_c: 50,
      water_level_m: 9,
      sensor_health: "failed",
    },
  ].map((r, i) => ({
    id: String(i),
    sampled_at: "2026-10-31T09:00:00Z",
    received_at: "2026-10-31T09:00:01Z",
    battery_percent: 90,
    sensor_health: "healthy",
    ...r,
  }));
  const result = hourlyMeans(readings);
  assert.equal(result[0].temperature, 25);
  assert.equal(result[0].level, 1.5);
  assert.equal(result[0].coverage, 2);
  assert.deepEqual(hourlyMeans([]), []);
});
test("chart windows apply elapsed hours and preserve missing hours as nulls", async () => {
  const { hourlyWindow } = await import("../src/lib/dashboard.ts");
  const make = (at) => ({
    id: at,
    node_id: "A",
    sampled_at: at,
    received_at: at,
    temperature_c: 28,
    water_level_m: 1,
    battery_percent: 80,
    sensor_health: "healthy",
  });
  const points = hourlyWindow(
    [
      make("2026-10-31T01:00:00Z"),
      make("2026-10-31T08:00:00Z"),
      make("2026-10-31T10:00:00Z"),
    ],
    now,
    3,
  );
  assert.equal(points.length, 4);
  assert.equal(points.find((p) => p.time === "09:00").temperature, null);
  assert.equal(points.find((p) => p.time === "08:00").temperature, 28);
  assert.equal(
    points.some((p) => p.time === "01:00"),
    false,
  );
});
