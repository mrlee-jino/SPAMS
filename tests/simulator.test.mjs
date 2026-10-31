import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
test("gateway simulator sends labeled, bounded packets without printing credentials", async () => {
  const packets = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    packets.push({ headers: req.headers, body: JSON.parse(body) });
    res.writeHead(201, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        accepted: true,
        source: "simulation",
        duplicate: false,
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const token = "local-test-device-token-not-a-real-secret";
    const child = spawn(process.execPath, ["scripts/simulate-gateway.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SPAMS_BASE_URL: `http://127.0.0.1:${server.address().port}`,
        SPAMS_DEVICE_TOKEN: token,
        SPAMS_NODE_IDS: Array.from(
          { length: 6 },
          (_, i) =>
            `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        ).join(","),
        SPAMS_SIM_PACKETS: "1",
      },
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.equal(code, 0, stderr);
    assert.equal(packets.length, 1);
    assert.equal(packets[0].headers["x-spams-simulator"], "true");
    assert.equal(packets[0].body.nodes.length, 6);
    assert.equal(packets[0].body.gateway.pump_state, "unknown");
    assert.equal(stdout.includes(token), false);
    assert.match(stdout, /SIMULATION packet 1\/1 accepted/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
