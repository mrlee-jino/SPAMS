import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const pondA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  pondB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const gateway = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  otherGateway = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const boot = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
async function setup() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`,
  );
  for (const file of [
    "202610310001_phase2.sql",
    "202610310002_device_workflows.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    `insert into auth.users values('${A}'),('${B}');insert into ponds(id,name) values('${pondA}','A'),('${pondB}','B');insert into pond_admins values('${pondA}','${A}'),('${pondB}','${B}');insert into gateways(id,pond_id,name) values('${gateway}','${pondA}','Gateway A'),('${otherGateway}','${pondB}','Gateway B');`,
  );
  return db;
}
async function asUser(db, id, fn) {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}';`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;reset request.jwt.claim.sub;");
  }
}
async function packet(db, sequence = 1, options = {}) {
  const nodeIds = (
    await db.query("select id from nodes where gateway_id=$1 order by slot", [
      gateway,
    ])
  ).rows.map((n) => n.id);
  const now = new Date().toISOString();
  return {
    gateway: {
      boot_id: boot,
      sequence,
      sampled_at: now,
      battery_percent: 80,
      voltage: 12.7,
      charging: true,
      solar_watts: 10,
      solar_voltage: 16,
      pump_state: "off",
    },
    nodes: nodeIds.map((node_id) => ({
      node_id,
      boot_id: boot,
      sequence,
      sampled_at: now,
      temperature_c: 28.4,
      water_level_m: 1.2,
      battery_percent: 80,
      sensor_health: "healthy",
      ...options,
    })),
  };
}
async function sixNodes(db) {
  await db.exec(
    `insert into nodes(gateway_id,label,slot,ultrasonic_enabled) select '${gateway}','Node '||n,n,n<=3 from generate_series(1,6)n;`,
  );
}
test("RLS isolates ponds, descendant nodes and telemetry; membership and credentials cannot be self-granted", async () => {
  const db = await setup();
  try {
    await sixNodes(db);
    const p = await packet(db);
    await db.query("select ingest_telemetry($1,$2)", [
      gateway,
      JSON.stringify(p),
    ]);
    await asUser(db, A, async () => {
      assert.deepEqual((await db.query("select name from ponds")).rows, [
        { name: "A" },
      ]);
      assert.equal((await db.query("select * from nodes")).rows.length, 6);
      assert.equal(
        (await db.query("select * from node_telemetry")).rows.length,
        6,
      );
      await assert.rejects(
        db.exec(`insert into pond_admins values('${pondB}','${A}')`),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from device_credentials"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select ingest_telemetry($1,$2)", [
          gateway,
          JSON.stringify(p),
        ]),
        /permission denied/,
      );
      await assert.rejects(
        db.exec(`update gateways set control_enabled=true`),
        /permission denied/,
      );
    });
    await asUser(db, B, async () => {
      assert.equal((await db.query("select * from nodes")).rows.length, 0);
      assert.equal(
        (await db.query("select * from node_telemetry")).rows.length,
        0,
      );
      await assert.rejects(
        db.query("select request_pump_command($1,$2,$3)", [
          gateway,
          "stop",
          crypto.randomUUID(),
        ]),
        /Not authorized/,
      );
    });
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from ponds"), /permission denied/);
  } finally {
    await db.close();
  }
});
test("ingestion is transactional, deduplicated, gateway-scoped and capability checked", async () => {
  const db = await setup();
  try {
    await sixNodes(db);
    const p = await packet(db);
    const result = await db.query("select ingest_telemetry($1,$2) as result", [
      gateway,
      JSON.stringify(p),
    ]);
    assert.equal(result.rows[0].result.duplicate, false);
    assert.equal(
      (
        await db.query("select ingest_telemetry($1,$2) as result", [
          gateway,
          JSON.stringify(p),
        ])
      ).rows[0].result.duplicate,
      true,
    );
    assert.equal(
      (await db.query("select * from node_telemetry")).rows.length,
      6,
    );
    const bad = await packet(db, 2);
    bad.nodes[0].node_id = crypto.randomUUID();
    await assert.rejects(
      db.query("select ingest_telemetry($1,$2)", [
        gateway,
        JSON.stringify(bad),
      ]),
      /not assigned/,
    );
    assert.equal(
      (await db.query("select * from gateway_telemetry")).rows.length,
      1,
    );
    const acoustic = await packet(db, 3);
    acoustic.nodes[5].acoustic = {
      echo_us: 1500,
      amplitude: 0.5,
      valid_returns: 80,
      quality: "usable",
    };
    await assert.rejects(
      db.query("select ingest_telemetry($1,$2)", [
        gateway,
        JSON.stringify(acoustic),
      ]),
      /not enabled/,
    );
  } finally {
    await db.close();
  }
});
test("commands enforce disabled control, six-node freshness and battery interlocks; requests are idempotent and audited", async () => {
  const db = await setup();
  try {
    await sixNodes(db);
    const send = async (action, key) =>
      asUser(db, A, () =>
        db.query(
          "select row_to_json(request_pump_command($1,$2,$3)) as command",
          [gateway, action, key],
        ),
      );
    await assert.rejects(send("start", crypto.randomUUID()), /disabled/);
    await db.exec(
      `update gateways set control_enabled=true,last_seen_at=now(),last_sample_at=now(),battery_percent=80 where id='${gateway}'`,
    );
    await assert.rejects(
      send("start", crypto.randomUUID()),
      /Water-level interlock/,
    );
    await db.query("select ingest_telemetry($1,$2)", [
      gateway,
      JSON.stringify(await packet(db)),
    ]);
    await db.exec(
      `update gateways set battery_percent=10 where id='${gateway}'`,
    );
    await assert.rejects(
      send("start", crypto.randomUUID()),
      /Battery interlock/,
    );
    await db.exec(
      `update gateways set battery_percent=80 where id='${gateway}'`,
    );
    const key = crypto.randomUUID();
    const first = (await send("start", key)).rows[0].command;
    assert.equal(first.status, "pending");
    assert.equal((await send("start", key)).rows[0].command.id, first.id);
    await assert.rejects(send("stop", key), /Idempotency key conflict/);
    await assert.rejects(send("start", crypto.randomUUID()), /unresolved/);
    assert.equal(
      (await db.query("select * from command_events")).rows.length,
      1,
    );
    await asUser(db, B, async () =>
      assert.equal(
        (await db.query("select * from pump_commands")).rows.length,
        0,
      ),
    );
    const claimed = (
      await db.query("select * from claim_pump_commands($1)", [gateway])
    ).rows;
    assert.equal(claimed[0].status, "delivered");
    assert.equal(
      (await db.query("select * from claim_pump_commands($1)", [gateway])).rows
        .length,
      0,
    );
    await db.query("select acknowledge_pump_command($1,$2,$3)", [
      gateway,
      first.id,
      "acknowledged",
    ]);
    await db.query("select acknowledge_pump_command($1,$2,$3)", [
      gateway,
      first.id,
      "completed",
    ]);
    assert.deepEqual(
      (
        await db.query(
          "select event from command_events order by created_at,id",
        )
      ).rows
        .map((e) => e.event)
        .sort(),
      ["requested", "delivered", "acknowledged", "completed"].sort(),
    );
    await assert.rejects(
      db.query("select acknowledge_pump_command($1,$2,$3)", [
        gateway,
        first.id,
        "rejected",
      ]),
      /Invalid transition/,
    );
  } finally {
    await db.close();
  }
});
test("delivery rechecks water safety, expires pending commands and prevents cross-gateway acknowledgments", async () => {
  const db = await setup();
  try {
    await sixNodes(db);
    await db.query("select ingest_telemetry($1,$2)", [
      gateway,
      JSON.stringify(await packet(db)),
    ]);
    await db.exec(
      `update gateways set control_enabled=true where id='${gateway}'`,
    );
    const c = (
      await asUser(db, A, () =>
        db.query(
          "select row_to_json(request_pump_command($1,$2,$3)) as command",
          [gateway, "start", crypto.randomUUID()],
        ),
      )
    ).rows[0].command;
    await db.exec(`update node_telemetry set water_level_m=0.1`);
    assert.equal(
      (await db.query("select * from claim_pump_commands($1)", [gateway])).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query("select status from pump_commands")).rows[0].status,
      "rejected",
    );
    await assert.rejects(
      db.query("select acknowledge_pump_command($1,$2,$3)", [
        otherGateway,
        c.id,
        "completed",
      ]),
      /not found/,
    );
    await db.exec(
      `insert into pump_commands(gateway_id,requested_by,action,idempotency_key,requested_at,expires_at) values('${gateway}','${A}','stop',gen_random_uuid(),now()-interval '2 minutes',now()-interval '1 minute')`,
    );
    await db.query("select * from claim_pump_commands($1)", [gateway]);
    assert.equal(
      (
        await db.query(
          "select count(*)::integer as n from pump_commands where status='expired'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
