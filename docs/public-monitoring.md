# Public monitoring and the next field milestone

## No visitor authentication

The home page and `/live` now show public database records without sign-in. `/demo` is the separate fixed-data preview. `/login` redirects to the public home page; authentication cookies and session refresh are no longer used.

Apply all four migrations in order in Supabase SQL Editor. If Phase 2's first two migrations are already applied, run only:

1. `202610310003_public_monitoring.sql`
2. `202610310004_research_jobs.sql`

The public-monitoring migration marks existing/new ponds public by default, as requested. An owner can set `ponds.is_public=false` through SQL Editor to hide a pond and its descendant records. RLS grants anonymous SELECT only for public pond telemetry, device status, forecasts and alerts. It grants no access to memberships, credentials, command requests or audit events. Anonymous writes are denied. The server dashboard uses the publishable key under anonymous RLS, never a service-key read bypass.

Remote pump requests are disabled at the API and the SQL function permission is revoked from authenticated users. The migration disables physical command delivery on registered gateways. Visitors can see the last reported relay state; they cannot operate it. Legacy command/audit tables remain intact for future commissioning.

For a new deployment run `supabase/provision-public-workspace.sql` once. It creates a pond, gateway and six nodes, without an Auth account. Do not provision a duplicate if those records already exist. Slots 1–3 are configured for optional ultrasonic observations; leave those fields absent until suitable hardware is installed.

Set these in Vercel and redeploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only, device ingestion and research worker)
- `CRON_SECRET` (server-only, a separate high-entropy scheduler credential (at least 32 characters))

Cloud environment variables do not automatically populate Vercel. Never send secrets in chat or commit `.env.local`.

## Separate test telemetry from actual measurements

Create a separate **simulation** gateway using the public provisioning script with `source := 'simulation'`. Keep your physical gateway registered as `hardware`. Do not change a gateway's source after collecting data; make a separate registry entry instead.

The database derives each telemetry record's source from the registered gateway, not from submitted JSON. The public page prominently labels software-generated records. CSV exports retain the source column, and forecast/alert processing separates simulation and hardware records. Missing sensor or power measurements remain null. A bare USB-powered ESP32 must not invent battery voltage, battery percentage, solar output or charging state.

Device provisioning is done through trusted SQL administration: generate a random token with at least 32 bytes of entropy, store only its SHA-256 hex digest in `device_credentials` with its gateway UUID, and securely place the raw token on that gateway. Do not give the ESP32 the Supabase secret key. This credential is for machine ingestion, not visitor authentication.

## Gateway simulator

Set `SPAMS_BASE_URL`, `SPAMS_DEVICE_TOKEN` and `SPAMS_NODE_IDS` (six comma-separated registered node UUIDs) in your local shell or secure environment settings, then run:

```sh
npm run simulate:gateway
```

Defaults to one packet. Optional `SPAMS_SIM_PACKETS` and `SPAMS_SIM_INTERVAL_MS` control a bounded run (30-second interval by default). The simulator marks its requests; the API rejects that marker when the credential belongs to a hardware gateway **before ingesting any values**. The tool never prints its token. Its three acoustic entries are synthetic, not disease or fish-activity findings.

On a proxy-restricted cloud runtime, preserve the configured proxy. With Node 24, set `NODE_USE_ENV_PROXY=1` for network-aware Node tools. The app's destination must be allowed in the runtime's network settings. Do not disable TLS verification. The simulator has been tested against an isolated local HTTP fixture, not against your hosted project or physical ESP32.

## Research processing

`GET` or `POST /api/jobs/research` requires `Authorization: Bearer <CRON_SECRET>`. This is not a public mutation endpoint. Schedule it with a trusted scheduler or invoke it from a secure developer tool. Vercel's cron scheduler can supply this header when `CRON_SECRET` is configured, but schedule limits depend on your plan; no default cron schedule has been added or deployed.

The processor reads the previous 24 hours using 1,000-row ID-cursor pages, with a 100,000-row processing budget per pond. Exceeding the budget returns a failure rather than publishing a forecast from truncated data. Each pond/source publication is atomic and idempotent; if a multi-pond run fails later, completed pond results remain valid.

The OLS baseline requires the last six consecutive **completed** UTC hours, each with at least four healthy temperature-reporting nodes. It averages samples per node first, then averages nodes equally. Missing hours and temperature coverage are never invented. The forecast describes the mean during the following hour; `target_at` is that hour's end. Run at the top of the hour for a one-hour horizon. Persisted records retain source, coverage, training window, target and model version.

Rolling chronological holdouts report model MAE/RMSE and compare with persistence where enough history exists. These are descriptive scores on available data, not an independent field-validation result. There is no fabricated accuracy percentage or confidence interval.

Alert rules currently cover gateway/node freshness, reported sensor failures, low gateway battery against its configured threshold, and low water level against the gateway's configured minimum. Open rules are deduplicated; resolution and reopening preserve history. Alerts update only when the job runs. Public connection indicators update independently from timestamps. No email/SMS notification service is configured.

## Complete research exports

Analytics and Overview provide a paginated CSV export with an optional local-time date range (default last 24 hours, maximum 31 days). The API applies a received-time cutoff and ID cursor; CSV retains UTC measurement timestamps, sensor health and source. It does not silently stop at the dashboard's 1,000-row chart cap. The browser refuses exports above 100,000 observations and asks for a narrower window without downloading an incomplete file. For larger exports use offline database tools. Concurrent backfill transactions can affect reproducibility across HTTP pages; use a database snapshot for publication-grade frozen datasets.

## Validation

Local validation covers migrations/RLS, denied private-table reads and public writes, simulation provenance, forecasts and persistence metrics, alert publication, pagination, CSV escaping, and the simulator protocol. Chromium checks with local mocked database responses verify anonymous browsing, all nine tabs at desktop/mobile sizes, a complete 1,201-row CSV download, simulation labels, empty/error states and disabled public controls. These do not establish that hosted migrations, scheduling, Realtime or physical sensors have been activated.

## First physical test

You reported a newly bought ESP32 and a DS18B20 module that is not wired yet. Start with [the DS18B20 commissioning guide](hardware-first-node.md). Confirm the board and module pin labels before choosing GPIOs. Water-level sensor selection, ESP-NOW firmware, gateway forwarding, battery instrumentation, pump commissioning, six-node field reliability, and hydroacoustic validation remain physical integration work. None is claimed complete by these software changes.
