/** No keys or real node IDs are embedded. Credentials stay in the calling process. */
import { randomUUID } from "node:crypto";
const origin = process.env.SPAMS_BASE_URL,
  token = process.env.SPAMS_DEVICE_TOKEN,
  ids = (process.env.SPAMS_NODE_IDS ?? "").split(",").filter(Boolean);
if (!origin || !token || ids.length !== 6)
  throw new Error(
    "Set SPAMS_BASE_URL, SPAMS_DEVICE_TOKEN and six comma-separated SPAMS_NODE_IDS for a SIMULATION gateway.",
  );
const count = Number(process.env.SPAMS_SIM_PACKETS ?? 1),
  interval = Number(process.env.SPAMS_SIM_INTERVAL_MS ?? 30000);
if (
  !Number.isInteger(count) ||
  count < 1 ||
  count > 2880 ||
  !Number.isFinite(interval) ||
  interval < 1000
)
  throw new Error("Invalid packet count/interval.");
const boot = randomUUID();
const nodeBoots = ids.map(() => randomUUID());
for (let i = 0; i < count; i++) {
  const sampled_at = new Date().toISOString();
  const payload = {
    gateway: {
      boot_id: boot,
      sequence: i,
      sampled_at,
      battery_percent: 84,
      voltage: 12.8,
      charging: true,
      solar_watts: 18.4,
      solar_voltage: 17.6,
      pump_state: "unknown",
    },
    nodes: ids.map((node_id, n) => ({
      node_id,
      boot_id: nodeBoots[n],
      sequence: i,
      sampled_at,
      temperature_c: Number((28.4 + Math.sin(i / 12 + n) * 0.3).toFixed(2)),
      water_level_m: Number((1.22 + Math.sin(i / 8 + n) * 0.02).toFixed(3)),
      battery_percent: 80 - n * 3,
      sensor_health: "healthy",
      ...(n < 3
        ? {
            acoustic: {
              echo_us: 1480 + n * 12,
              amplitude: 0.4,
              valid_returns: 90,
              quality: "usable",
            },
          }
        : {}),
    })),
  };
  const r = await fetch(new URL("/api/device/telemetry", origin), {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "x-spams-simulator": "true",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error(
      `Simulator request rejected (${r.status}); verify the simulation credential and migrations.`,
    );
  const result = await r.json();
  if (result.source !== "simulation")
    throw new Error(
      "Stopped: this credential is not attached to a simulation gateway. Use an isolated software test gateway.",
    );
  console.log(
    `SIMULATION packet ${i + 1}/${count} accepted${result.duplicate ? " (duplicate)" : ""}`,
  );
  if (i < count - 1)
    await new Promise((resolve) => setTimeout(resolve, interval));
}
