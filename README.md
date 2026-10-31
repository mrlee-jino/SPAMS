# SPAMS-S

Smart Pond Aquaculture Monitoring System-Swarm: a six-node stationary aquaculture research platform.

## Phase 1

A responsive dark-mode frontend with **explicitly simulated data**. There is no hardware connection, authentication, Supabase client, telemetry ingestion, persistent storage, or real pump endpoint. The administrator avatar is a presentation placeholder. Do not deploy this preview as a production control system.

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
src/lib/                Strongly typed fixtures and deterministic regression calculation
tests/                  Regression model tests using the built-in Node test runner
docs/architecture.md     System boundaries and proposed next-phase backend design
```

Dependencies are locked in `package-lock.json`: Next.js 16.4.3, React 19.3.1, Tailwind 4.3.3, Recharts 3.10.1, Lucide React 1.66.0, TypeScript 5.9.3. No Supabase dependency is required until its integration is implemented.

### Validation

Lint, TypeScript, four regression tests and an optimized production build are required checks. Browser smoke validation covers every implemented route at desktop and mobile sizes, chart range selection, sample export, notifications, mobile navigation, simulated pump cancel/start/stop/reset, and invalid-node 404 behavior. Loading and error boundaries are implemented; forced runtime error recovery has not been automated.

### Next, after Phase 1 review

Review the layout, terminology, simulated states and research scope. Then implement Supabase schema/migrations, administrator Auth/RLS and server-only data access, followed by Realtime and durable commands. See [architecture](docs/architecture.md). Hardware integration and Phase 2 are intentionally pending review. Vercel deployment has not been performed.
