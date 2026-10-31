# Architecture and implementation boundary

## Current frontend

Next.js App Router renders route entry points and validates node IDs. Client components own navigation overlays, chart range selection, CSV download and local command simulation. Shared panels consume typed fixtures in `src/lib/simulation.ts`. Tailwind v4 is initialized through PostCSS; shared theme and responsive component styles live in `src/app/globals.css`. No remote fonts or image services are required.

All data is deterministic and labeled simulation. The UI uses one research pond, six stationary ESP32 nodes and a central gateway. Nodes measure water temperature and level. Only nodes 01–03 have optional underwater ultrasonic measurements. The gateway has solar charging, battery monitoring and pump relay control; the six nodes use separate batteries.

Conceptual data path:

```text
6 ESP32 nodes --ESP-NOW--> ESP32 gateway --Wi-Fi/HTTPS--> server-only ingestion
                                                               |
                                                  Supabase PostgreSQL
                                                               |
                                           Auth + RLS + authorized Realtime
                                                               |
                                                  Next.js user dashboard

Authenticated administrator --> command API --> durable pending command
Gateway authenticated poll/receive --> execute with interlocks --> device ACK
```

The diagram describes the target architecture, not a connection implemented in Phase 1.

## Proposed PostgreSQL model (not implemented)

| Table | Ownership / relationships | Important constraints and indexes |
| --- | --- | --- |
| ponds | Research workspace | Primary UUID, name |
| pond_admins | Pond and Supabase auth user | Composite unique pond/user membership; no self-grant policy |
| gateways | Belongs to pond | Unique device identifier, last heartbeat, firmware version |
| nodes | Belongs to gateway | Unique gateway/node identifier, ultrasonic capability, active flag |
| node_telemetry | Node FK | Sample and received timestamps, sequence, temperature, level, sensor quality; bounded physical values; unique device/sequence/session; index node/sample time descending |
| gateway_telemetry | Gateway FK | Voltage, battery percent (0–100), nullable solar fields, charging state; gateway/time index |
| acoustic_samples | Node FK | Raw echo time/amplitude, units, quality, calibration metadata; node/time index; capability enforcement |
| forecasts | Pond FK | Target time, generation time, model version, training window/coverage and predicted mean; pond/target time index |
| pump_commands | Gateway and requesting auth user FKs | Command UUID/idempotency key, desired action, timestamps/expiry; explicit pending/sent/acknowledged/failed/expired states; gateway/status/time index |
| command_events | Command FK | Append-only request, delivery, device acknowledgment, execution and rejection events; command/time index |
| alerts | Pond and optional node/gateway FKs | Rule, severity, opened/resolved timestamps, user acknowledgment; pond/status/time index |

Do not treat sending or accepting a command as device execution. Retain rejected and expired commands. Enforce valid state transitions transactionally and record provenance. Store heartbeat and sample timestamps separately; stale-data rules belong in shared domain logic, not text formatting.

## Security boundary for the next phase

- Use Supabase Auth for administrators and server-side session verification for every protected route/API. RLS permits dashboard reads only for authorized pond membership. Membership and device records cannot be self-assigned from browser code.
- The browser may use a publishable Supabase key with RLS. Service-role keys, device credential hashes and gateway credentials stay server-only. Never prefix privileged credentials with `NEXT_PUBLIC_`.
- Separate device ingestion authentication from administrator sessions. Authenticate each gateway, bind it to allowed nodes, validate payload size/schema/units/timestamps, rate-limit and deduplicate using sequence/session keys. Do not invent credentials in frontend fixtures.
- User pump requests require administrator authorization, CSRF protection appropriate to session transport, a short expiry, idempotency and durable audit. Check gateway freshness, water level and battery conditions. Gateway firmware must independently enforce interlocks and safe relay defaults.
- Authenticate and scope device acknowledgments. Distinguish received, executing, completed and rejected results. A timeout is unknown execution, not automatic success; retry policy must not duplicate physical actions.
- Subscribe only to authorized telemetry/status/alert channels through Supabase Realtime. Handle disconnect, reconnect, duplicate/out-of-order events, backfill and missing samples. Remove subscriptions on unmount.
- Evaluate hydroacoustics as experimental raw observations and quality metrics. Disease detection and validated fish-activity inference are outside current claims.

## Forecast research contract

Phase 1 uses ordinary least squares on six synthetic hourly mean temperatures, predicts the next hourly mean and displays the training window. It makes no accuracy or confidence claim. Before field use, define valid-node coverage, robust hourly aggregation, missing-sample handling, time zones, minimum training requirements and model versioning. Evaluate chronological holdouts against a persistence baseline and report MAE/RMSE with target provenance.

## Deployment sequence after review

1. Approve Phase 1 UX and field terminology.
2. Add migrations, RLS tests and administrator authentication with secure server boundaries.
3. Replace fixtures through typed data adapters and verify empty/error/stale/offline behavior with real queries.
4. Implement separately authenticated ingestion, Realtime and durable command workflows with integration tests.
5. Add firmware integration and validate physical safeguards before enabling any relay control.
6. Configure Vercel environment variables and Supabase redirect URLs; use preview deployments before production.

No Phase 2 migrations, Auth flows, APIs, device credentials or cloud deployment have been created.
