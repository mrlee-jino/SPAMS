import test from "node:test";
import assert from "node:assert/strict";
import { researchForecast } from "../src/lib/research.ts";
import { collectPages, csvCell } from "../src/lib/pagination.ts";
const now = Date.parse("2026-11-01T12:00:00Z");
function observations(hours = 12) {
  return Array.from({ length: hours }, (_, h) =>
    Array.from({ length: 4 }, (_, n) => ({
      id: `${h}-${n}`,
      node_id: String(n),
      sampled_at: new Date(now - (hours - h) * 3600000).toISOString(),
      received_at: new Date(now).toISOString(),
      temperature_c: 25 + h * 0.1,
      water_level_m: 1.2,
      battery_percent: 80,
      sensor_health: "healthy",
      source: "hardware",
    })),
  ).flat();
}
test("OLS uses six consecutive completed hours, reports coverage and compares chronological persistence holdouts", () => {
  const result = researchForecast(observations(), now);
  assert(result);
  assert.equal(result.target_at, "2026-11-01T13:00:00.000Z");
  assert(Math.abs(result.predicted_temperature_c - 26.2) < 1e-9);
  assert.equal(result.valid_nodes, 4);
  assert.equal(result.evaluation.samples, 6);
  assert(result.evaluation.model.mae < 1e-9);
  assert(Math.abs(result.evaluation.persistence.mae - 0.1) < 1e-9);
});
test("forecast rejects missing hours or insufficient valid temperature nodes and ignores incomplete current hour", () => {
  assert.equal(
    researchForecast(
      observations().filter((o) => o.node_id !== "3"),
      now,
    ),
    null,
  );
  const data = observations().filter(
    (o) => o.sampled_at !== "2026-11-01T08:00:00.000Z",
  );
  assert.equal(researchForecast(data, now), null);
  const nulls = observations().map((o) => ({
    ...o,
    temperature_c: o.node_id === "3" ? null : o.temperature_c,
  }));
  assert.equal(researchForecast(nulls, now), null);
  const current = observations();
  current.push({
    ...current[0],
    sampled_at: new Date(now).toISOString(),
    temperature_c: 60,
  });
  assert.equal(
    researchForecast(current, now).predicted_temperature_c,
    researchForecast(observations(), now).predicted_temperature_c,
  );
});
test("pagination collects more than 1000 rows and fails instead of returning a truncated result", async () => {
  const rows = Array.from({ length: 2501 }, (_, i) => ({
    id: String(i).padStart(6, "0"),
  }));
  const page = async (after) =>
    rows.filter((r) => !after || r.id > after).slice(0, 1000);
  assert.equal((await collectPages(page)).length, 2501);
  await assert.rejects(collectPages(page, 2000), /budget/);
  await assert.rejects(
    collectPages(async () => [{ id: "1" }]),
    /advance/,
  );
});
test("CSV escapes delimiters, quotes and formula-leading text", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(-2), '"-2"');
});
test("alert evaluation reports hardware faults, excludes simulation gateways and does not infer absent power", async () => {
  const { researchAlerts } = await import("../src/lib/research.ts");
  const gateways = [
    {
      id: "H",
      name: "Hardware gateway",
      data_source: "hardware",
      last_seen_at: new Date(now).toISOString(),
      last_sample_at: new Date(now).toISOString(),
      battery_percent: null,
      min_battery_percent: 25,
      min_water_level_m: 0.5,
    },
    {
      id: "S",
      name: "Simulator",
      data_source: "simulation",
      last_seen_at: null,
      last_sample_at: null,
      battery_percent: 0,
      min_battery_percent: 25,
      min_water_level_m: 0.5,
    },
  ];
  const nodes = [
    { id: "one", label: "Node one", gateway_id: "H" },
    { id: "two", label: "Node two", gateway_id: "H" },
    { id: "sim", label: "Simulated node", gateway_id: "S" },
  ];
  const latest = [
    {
      node_id: "one",
      sampled_at: new Date(now).toISOString(),
      sensor_health: "healthy",
      water_level_m: 0.2,
    },
  ];
  const alerts = researchAlerts(nodes, gateways, latest, now, "hardware");
  assert.deepEqual(alerts.map((a) => a.rule_key).sort(), [
    "node:one:level",
    "node:two:heartbeat",
  ]);
  assert.equal(alerts[0].severity, "critical");
});
