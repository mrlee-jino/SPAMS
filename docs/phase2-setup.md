# Phase 2: Supabase backend and authenticated workspace

## What is implemented

The public `/` dashboard and its pages remain an explicitly labeled simulation. `/login` authenticates provisioned administrators with Supabase email/password. `/live` is a separate, server-verified workspace showing authorized PostgreSQL records, with Overview, Nodes/details, Analytics, Predictions, Hydroacoustics, Pump control, Power, Alerts and Settings tabs. There is no automatic fallback from database failures or empty data to simulation.

Server rendering and APIs validate sessions using `auth.getUser()`. The Next.js proxy refreshes cookies; browser sessions do not establish authorization without a verified user and database RLS. Public registration and self-assigned administrator roles are not implemented. Next.js Server Actions supply same-origin protection for sign-in/sign-out, and custom pump endpoints require an exact same-origin request.

## Activate in Supabase and Vercel (browser only)

1. Open the project's Supabase SQL Editor. Run these versioned migrations **in order**, once:
   - `supabase/migrations/202610310001_phase2.sql`
   - `supabase/migrations/202610310002_device_workflows.sql`
   Alternatively, use a linked Supabase CLI project and `supabase db push`. A service/secret API key cannot execute SQL migrations; database or management access is separate.
2. In Supabase Authentication → Users → Add user → Create new user, create your administrator with an email/password. Set the password securely and confirm the email if required. Invitation/recovery callback screens are not implemented yet. Disable public signups in the Supabase Auth configuration if this project is administrator-only.
3. Copy that Auth user's UUID. Open `supabase/provision-workspace.sql`, replace the clearly marked placeholder UUID, and run it **once**. This creates one pond, its membership, one gateway and six nodes (slots 1–3 ultrasonic-enabled). It creates no telemetry and leaves `control_enabled=false`.
4. Add the environment variables below in Vercel, then redeploy. Values entered in the Codex cloud environment do **not** automatically transfer to Vercel. Add the same variables to local `.env.local` for development; never commit that file.
5. Set Supabase Auth Site URL to the deployed website URL, and configure permitted redirect URLs for any future invitation/recovery flows. The implemented sign-in uses email/password and does not need an OAuth callback.
6. Open `/login`, sign in, and verify `/live` shows your registered nodes with empty/offline states. An authenticated user with no membership sees no pond records. Test with a second user before onboarding any physical gateway.

| Variable | Where used | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public project URL | Auth, user and device access |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and SSR user clients under RLS | Auth and user access |
| `SUPABASE_SECRET_KEY` | Server-only device client | Device ingestion/delivery only |
| `NEXT_PUBLIC_SITE_URL` | Deployment identity for future redirects | Recommended; not used as the Supabase project URL |

Never use `NEXT_PUBLIC_` on a secret/service key. No secret is needed in browser code. Device routes import the privileged client through `server-only`; dashboard queries always use the user session and RLS. No keys are stored in these instructions.

## Data and Realtime

All tables have RLS. Anonymous roles have no table access. Authenticated administrators have SELECT only for their ponds and descendants; membership/device provisioning, writes and secret hashes cannot be self-granted. Narrow SECURITY DEFINER functions govern user commands. Device functions are executable only by the service role and are called by separately authenticated device routes.

Realtime publishes telemetry/status/command/alert/forecast tables, never device credentials. The client subscribes through its authenticated Supabase session, re-fetches authoritative RLS-scoped snapshots after events, refreshes every 30 seconds as a fallback, and removes subscriptions on unmount. Disconnected and failed-refresh states remain explicit.

Sample timestamps determine freshness: ≤90 seconds fresh, 90 seconds–15 minutes stale, older or absent offline. Gateway transport heartbeat and measurement timestamps are separate. Current means exclude stale/failed sensors. Hourly charts weight nodes equally, exclude failed readings, use UTC buckets and do not fabricate gaps. The history endpoint caps at 1,000 observations and labels partial coverage; full research exports need paginated analysis. Latest readings are queried separately so capped history cannot incorrectly determine current status.

Stored forecasts retain model version, training window, generation and target timestamps. The live Predictions view displays stored records or an empty state; no scheduled production forecast job is enabled. The Phase 1 OLS demonstration remains available in simulation. Automated threshold alert evaluation, outbound notification delivery and account recovery UI are also not implemented.

## Device contract (prepared for later firmware)

No ESP32 firmware or physical hardware connection is included. Commission devices only after independent field safety validation.

Generate a random device token with at least 32 bytes of entropy outside the dashboard, provision it into the gateway securely, and store only its SHA-256 hex digest plus gateway UUID in `public.device_credentials` through trusted administration. Never use the Supabase secret key as a gateway credential. Device credentials may be revoked using `revoked_at`; browser roles cannot access them.

Device routes use `Authorization: Bearer <device token>`:

- `POST /api/device/telemetry`: validates JSON ≤32 KiB, up to six unique assigned nodes, numerical ranges, sensor-health values, boot UUIDs, safe integer sequences and timestamps (last 24 hours through 60 seconds ahead). Ingestion is transactional, gateway-scoped and deduplicated on gateway/node + boot + sequence. Per-gateway writes are capped at 60 new packets/minute. Backfill does not overwrite newer gateway snapshots. Only configured ultrasonic nodes may submit acoustic data.
- `POST /api/device/commands`: atomically claims unexpired requests, rechecks safety and records delivery. It returns newly delivered commands once. Firmware must persist command IDs to prevent repeat execution, enforce expiry/interlocks locally, and acknowledge results. A lost response is uncertain delivery; a new command must not be invented to compensate.
- `POST /api/device/commands/:id`: accepts `{ "status": "acknowledged" | "completed" | "rejected" }`, validates gateway ownership and allowed transitions, and appends audit events. Completed acknowledgments after expiry are rejected for manual reconciliation. Repeating the same terminal acknowledgment is idempotent.

Payload shape (placeholders, not valid provisioned device identifiers):

```json
{
  "gateway": {
    "boot_id": "<UUID per boot>", "sequence": 1,
    "sampled_at": "<ISO UTC timestamp>", "battery_percent": 84,
    "voltage": 12.8, "charging": true, "solar_watts": null,
    "solar_voltage": null, "pump_state": "off"
  },
  "nodes": [{
    "node_id": "<registered node UUID>", "boot_id": "<UUID per node boot>",
    "sequence": 1, "sampled_at": "<ISO UTC timestamp>",
    "temperature_c": 28.4, "water_level_m": 1.24, "battery_percent": 86,
    "sensor_health": "healthy",
    "acoustic": { "echo_us": 1480, "amplitude": 0.42, "valid_returns": 92, "quality": "usable" }
  }]
}
```

Temperature, water level and node battery may be null when unavailable. Omit `acoustic` if absent; solar fields must explicitly be null when unavailable. Acoustic data represents experimental raw observations, not a disease diagnosis.

## Pump safety and audit

`POST /api/pump-commands` requires an administrator session, exact same-origin request, gateway membership, action and UUID idempotency key. Requests and every transition are audited in PostgreSQL. Browser/device roles cannot edit/delete event history; privileged database owners retain administrative control.

Physical control is disabled by default. A project owner must independently validate firmware and hardware safety before deliberately enabling it in secure administration. Start requires:

- Fresh gateway heartbeat and battery measurement (90 seconds).
- Battery at least the gateway's configured threshold (default 25%).
- All six registered nodes have fresh, healthy water-level measurements at or above the configured minimum (default 0.5 m).
- No unresolved pending/delivered/acknowledged command and no request in the preceding five seconds.

The same checks run at delivery. Commands expire in 60 seconds. Stop bypasses the start-only battery/level checks, but still needs a reachable, enabled gateway and no unresolved delivery. The UI retains the request key for uncertain transport failures. Expired pending commands are marked expired when commands are next requested/claimed; delivered/acknowledged timeouts remain explicitly uncertain and block replacement commands until physically reconciled by a trusted operator. A physical emergency stop/manual override is necessary; this web UI is not one.

A `completed` command acknowledgment is separate from telemetry-reported relay state. Do not infer that accepting or delivering a request means the pump executed it.

## Validation and remaining activation

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

The tests execute both migrations in local PostgreSQL (PGlite) with Auth roles, test RLS across two users/ponds, deny credentials and membership escalation, verify ingestion rollback/deduplication/capability checks, command interlocks/ownership/idempotency/state transitions/audit, validate packet boundaries, and check aggregation/regression mathematics. Browser checks additionally cover login/configuration failure states, device authentication and CSRF rejection, and use an isolated local HTTPS Auth/data mock for successful sign-in/sign-out, all nine authenticated tabs on desktop/mobile and disabled physical controls. These mocks do not validate hosted Auth or hosted Realtime. Local tests are not proof that migrations were applied to the hosted project or that hosted Auth/Realtime settings are correct.

Hosted verification requires the project's network destination allowed in this cloud environment, the migrations applied, and an administrator account/membership. Do not share passwords or keys in chat; use Supabase and deployment settings.
