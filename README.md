# SPAMS-S

Smart Pond Aquaculture Monitoring System-Swarm: a six-node stationary aquaculture research platform.

## Current status

Phase 2 backend and the separate authenticated `/live` workspace are implemented. The public dashboard remains a simulation. Follow [Phase 2 activation instructions](docs/phase2-setup.md) to apply migrations, provision an administrator and configure Supabase/Vercel. Hosted activation is separate from local code validation.

## Phase 1 preview

The public preview is a responsive dark-mode frontend with **explicitly simulated data**. Its readings, administrator avatar and pump acknowledgments remain presentation-only. Real authentication, database access and durable commands live separately in `/login`, `/live` and the APIs described in the Phase 2 guide. No physical hardware is connected.

### Run

Requires Node.js 22.18+ (validated with Node 24.19.0) and npm.

```sh
npm ci
npm run dev
```

Open the development server on port 3000. Production:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Build and development scripts use Next.js's supported webpack mode for compatibility with this cloud environment's Turbopack process/port restrictions. No environment variables or secrets are needed for Phase 1.

### Included

- Overview with six node cards, conceptual pond map, status summaries, gateway power and notifications.
- Nodes and individual node details, including online, stale, offline and sensor-health presentation.
- Analytics with interactive 6/12/24-hour temperature and water-level charts and sample CSV export.
- One-hour Linear Regression prediction fitted to the last six simulated hourly mean temperatures; no validated performance claims.
- Experimental hydroacoustics for three nodes, with synthetic raw values and quality indicators; **not a disease detector**.
- Pump control with confirmation, cancel, start/stop and session-only simulated acknowledgment history.
- Power monitoring, alerts and read-only settings.
- App Router loading, error/retry and not-found pages, plus empty command and research-observation states.

Current temperature aggregates include only four fresh online nodes. Node 05 shows stale, last-known readings; Node 06 has no current readings. The historical mean series is a separate synthetic fixture, not computed from the current snapshot. Heartbeat ages are frozen scenario labels, not a running clock. Node detail charts explicitly show shared pond history rather than fabricated per-node history. Pump state and command history reset on page reload; all acknowledgments are local simulations.

### Structure

```text
src/app/                 App Router routes, shared layout, loading/error/404 boundaries
src/components/          Workspace shell, shared UI and reusable domain panels
src/lib/                 Typed models, aggregation, validation, Supabase and server helpers
src/proxy.ts             Supabase session refresh
supabase/                Migrations and administrator workspace provisioning
tests/                   PostgreSQL/RLS, command, telemetry, CSRF and regression tests
docs/phase2-setup.md      Browser-only Supabase/Vercel activation guide
```

Dependencies are locked in `package-lock.json`: Next.js 16.4.3, React 19.3.1, Tailwind 4.3.3, Recharts 3.10.1, Lucide React 1.66.0, TypeScript 5.9.3. Phase 2 adds `@supabase/ssr`, `@supabase/supabase-js`, `server-only`, and a development-only PGlite PostgreSQL test engine.

### Validation

Lint, TypeScript, 15 tests (including four regression tests) and an optimized production build are required checks. Browser smoke validation covers every implemented route at desktop and mobile sizes, chart range selection, sample export, notifications, mobile navigation, simulated pump cancel/start/stop/reset, and invalid-node 404 behavior. Loading and error boundaries are implemented; forced runtime error recovery has not been automated.

### Backend activation and next steps

Apply the Phase 2 migrations and provision a Supabase administrator using [the setup guide](docs/phase2-setup.md). Physical hardware integration, production forecast scheduling and automated alert rules remain future work. Vercel deployment has not been performed by this agent.
