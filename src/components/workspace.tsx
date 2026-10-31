"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Battery,
  Bell,
  ChevronDown,
  ChevronRight,
  Droplets,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Radio,
  Settings,
  ShieldCheck,
  Sun,
  Thermometer,
  Waves,
  X,
  Zap,
  ChartNoAxesCombined,
  Clock3,
  Download,
} from "lucide-react";
import { history, navigation, nodes } from "@/lib/simulation";
import { Badge, Panel } from "./ui";
import { NodeCard } from "./node-card";
import { HistoryChart } from "./history-chart";
import { Forecast } from "./forecast-panel";
import { PowerPanel } from "./power-panel";
import { PumpPanel } from "./pump-panel";
import { AlertsPanel } from "./alerts-panel";
import { PondMap } from "./pond-map";
const icons = [
  LayoutDashboard,
  Radio,
  ChartNoAxesCombined,
  ArrowUpRight,
  Waves,
  Droplets,
  Zap,
  Bell,
  Settings,
];
function Metric({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  color = "teal",
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  icon: typeof Thermometer;
  color?: string;
}) {
  return (
    <article className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={18} className={color} />
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <p>{detail}</p>
      <div className={`mini-spark ${color}`}>
        <svg viewBox="0 0 200 25" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 19 L12 17 L25 20 L38 11 L50 14 L63 9 L75 13 L88 7 L100 10 L113 5 L125 10 L138 5 L150 8 L163 3 L175 7 L188 3 L200 5" />
        </svg>
      </div>
    </article>
  );
}
function ExportButton() {
  function download() {
    const blob = new Blob(
      [
        "time,temperature_c,water_level_m,source\n" +
          history
            .map((p) => `${p.time},${p.temperature},${p.level},simulation`)
            .join("\n"),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spams-s-simulated-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button onClick={download}>
      <Download size={14} /> Export sample CSV
    </button>
  );
}
export function Workspace({
  section,
  nodeId,
}: {
  section: string;
  nodeId?: string;
}) {
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = nodes.find((n) => n.id === nodeId);
  const title =
    section === "dashboard"
      ? "Pond overview"
      : section === "node-detail"
        ? `${selected?.name} details`
        : (navigation.find(([k]) => k === section)?.[1] ?? "Overview");
  const fresh = nodes.filter((n) => n.status === "online");
  const mean =
    fresh.reduce((a, n) => a + (n.temperature ?? 0), 0) / fresh.length;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Link href="/demo" className="brand">
          <div className="brand-icon">
            <Waves size={26} />
          </div>
          <div>
            SPAMS<span>-S</span>
            <small>POND INTELLIGENCE</small>
          </div>
        </Link>
        <button
          className="mobile-close"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <div className="workspace-selector">
          <span className="pond-avatar">
            <Waves size={18} />
          </span>
          <div>
            Research pond A<small>Aquaculture research site</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {navigation.map(([key, label], i) => {
            const Icon = icons[i];
            return (
              <Link
                key={key}
                href={key === "dashboard" ? "/demo" : `/${key}`}
                aria-current={
                  section === key ||
                  (key === "nodes" && section === "node-detail")
                    ? "page"
                    : undefined
                }
                onClick={() => setMobile(false)}
                className={
                  section === key ||
                  (key === "nodes" && section === "node-detail")
                    ? "active"
                    : ""
                }
              >
                <Icon size={18} />
                {label}
                {key === "alerts" && <span className="nav-count">2</span>}
                {key === "hydroacoustics" && (
                  <span className="experimental-dot" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-note">
            <FlaskConical size={19} />
            <strong>Built for discovery</strong>
            <p>
              Six nodes. One connected pond.
              <br />
              Better insights for aquaculture.
            </p>
            <span>RESEARCH PROTOTYPE</span>
          </div>
          <div className="profile">
            <span>PV</span>
            <div>
              Public research viewer<small>Simulation workspace</small>
            </div>
            <ShieldCheck size={15} />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <Link href="/" className="text-link">
              Public monitoring
            </Link>
            <span className="demo-top">
              <span /> Simulation mode
            </span>
            <button
              className="icon-button"
              aria-label="Open notifications"
              aria-expanded={notifications}
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={18} />
              <i className="notification-dot" />
            </button>
            <Link
              href="/settings"
              className="top-avatar"
              aria-label="Workspace settings"
            >
              RA
            </Link>
          </div>
          {notifications && (
            <div className="notification-popover">
              <strong>Sample notifications</strong>
              <p>Node 06 offline · 28 min</p>
              <p>Node 05 stale heartbeat · 4 min</p>
              <Link href="/alerts" onClick={() => setNotifications(false)}>
                Open alerts →
              </Link>
            </div>
          )}
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                RESEARCH POND A <span>/</span> MONITORING WORKSPACE
              </div>
              <h1>
                {title}
                <span className="title-dot" />
              </h1>
              <p>
                {section === "dashboard"
                  ? "A clearer picture of your pond, from every node."
                  : "Explore your aquaculture research workspace."}
              </p>
            </div>
            <div className="heading-actions">
              <span className="snapshot">
                <Clock3 size={14} /> Sample day · 24-hour snapshot
              </span>
              <ExportButton />
            </div>
          </div>
          <div className="simulation-banner">
            <FlaskConical size={17} />
            <div>
              <strong>Simulated data</strong>
              <span>
                Phase 1 preview. Readings, statuses and controls are
                illustrative; no hardware is connected.
              </span>
            </div>
            <Badge tone="blue">DEMO</Badge>
          </div>
          {section === "dashboard" && (
            <>
              <div className="metrics-grid">
                <Metric
                  label="Mean water temperature"
                  value={mean.toFixed(1)}
                  unit="°C"
                  detail="4 fresh nodes · stale readings excluded"
                  icon={Thermometer}
                />
                <Metric
                  label="Mean water level"
                  value="1.23"
                  unit="m"
                  detail="Stable across reporting nodes"
                  icon={Droplets}
                  color="blue"
                />
                <Metric
                  label="Monitoring nodes"
                  value="4"
                  unit="/ 6 online"
                  detail="1 stale · 1 offline"
                  icon={Radio}
                />
                <Metric
                  label="Gateway battery"
                  value="84"
                  unit="%"
                  detail="Solar charging · 12.8 V"
                  icon={Battery}
                  color="green"
                />
              </div>
              <div className="main-grid">
                <Panel
                  title="Water temperature"
                  subtitle="Historical pond-wide mean · hourly samples"
                  action={<span className="unit-tag">°C</span>}
                >
                  <HistoryChart />
                </Panel>
                <Forecast />
              </div>
              <div className="section-heading">
                <div>
                  <h2>
                    Across the pond <span>6 monitoring nodes</span>
                  </h2>
                  <p>Individual sensor readings and connection health</p>
                </div>
                <Link className="text-link" href="/nodes">
                  Manage nodes <ArrowRight size={14} />
                </Link>
              </div>
              <div className="nodes-grid">
                {nodes.map((n) => (
                  <NodeCard key={n.id} node={n} />
                ))}
              </div>
              <div className="bottom-grid">
                <PowerPanel />
                <PumpPanel />
                <AlertsPanel />
              </div>
              <PondMap />
            </>
          )}
          {section === "nodes" && (
            <>
              <div className="section-heading">
                <h2>
                  Node fleet <span>4 online · 1 stale · 1 offline</span>
                </h2>
                <Badge>ESP-NOW → Gateway → Cloud</Badge>
              </div>
              <div className="nodes-grid">
                {nodes.map((n) => (
                  <NodeCard key={n.id} node={n} />
                ))}
              </div>
              <PondMap />
            </>
          )}
          {section === "node-detail" && selected && (
            <>
              <Link href="/nodes" className="text-link">
                ← All monitoring nodes
              </Link>
              <div className="detail-grid">
                <NodeCard node={selected} />
                <Panel
                  title="Device health"
                  subtitle={`${selected.position} · battery-powered ESP32`}
                >
                  <div className="detail-row">
                    <span>Node battery</span>
                    <strong>{selected.battery}% · sample</strong>
                  </div>
                  <div className="detail-row">
                    <span>Sensor health</span>
                    <strong>{selected.sensorHealth}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Experimental ultrasonic sensor</span>
                    <strong>
                      {selected.acoustic
                        ? "Installed in simulation"
                        : "Not installed"}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>Last heartbeat</span>
                    <strong>{selected.heartbeat} · snapshot</strong>
                  </div>
                </Panel>
              </div>
              {selected.status !== "online" && (
                <div className="info-box">
                  {selected.status === "offline"
                    ? "Offline: current temperature and level are unavailable."
                    : "Stale: displayed values are last known readings, excluded from current aggregates."}
                </div>
              )}
              <Panel
                title="Historical context"
                subtitle="Shared simulated pond-wide history; per-node history is not available in Phase 1"
              >
                <HistoryChart />
              </Panel>
            </>
          )}
          {section === "analytics" && (
            <>
              <div className="main-grid equal">
                <Panel
                  title="Temperature history"
                  subtitle="Simulated pond-wide hourly means"
                >
                  <HistoryChart />
                </Panel>
                <Panel
                  title="Water-level history"
                  subtitle="Simulated pond-wide hourly means"
                >
                  <HistoryChart level />
                </Panel>
              </div>
              <Panel
                title="Data coverage"
                subtitle="Current simulated snapshot"
              >
                <div className="coverage-grid">
                  {nodes.map((n) => (
                    <div key={n.id}>
                      <strong>{n.name}</strong>
                      <Badge tone={n.status === "online" ? "teal" : "amber"}>
                        {n.status}
                      </Badge>
                      <p>
                        {n.status === "online"
                          ? "Included in current aggregate"
                          : "Excluded from current aggregate"}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
          {section === "predictions" && (
            <div className="main-grid equal">
              <Forecast expanded />
              <Panel
                title="Model scope"
                subtitle="One-hour-ahead pond-wide mean temperature"
              >
                <div className="prose">
                  <h3>Linear Regression baseline</h3>
                  <p>
                    The preview fits the last six hourly simulated mean
                    temperatures and extrapolates one hour forward.
                  </p>
                  <h3>Research, with context</h3>
                  <p>
                    This is an illustrative trend estimate, not a calibrated
                    warning or a guarantee of future pond conditions. No
                    accuracy score is claimed.
                  </p>
                  <h3>Before field use</h3>
                  <p>
                    Define time alignment and valid-node coverage, retain
                    training timestamps, evaluate against held-out observations,
                    and compare with a persistence baseline.
                  </p>
                </div>
              </Panel>
            </div>
          )}
          {section === "hydroacoustics" && (
            <>
              <div className="info-box">
                <FlaskConical size={20} />
                <div>
                  <strong>Experimental fish-activity research</strong>
                  <p>
                    Underwater ultrasonic measurements are unvalidated
                    observations. They do not diagnose fish disease, estimate
                    fish health, or establish fish activity on their own.
                  </p>
                </div>
              </div>
              <div className="nodes-grid">
                {nodes
                  .filter((n) => n.acoustic)
                  .map((n, i) => (
                    <Panel
                      key={n.id}
                      title={n.name}
                      subtitle={n.position}
                      action={<Badge tone="blue">Experimental</Badge>}
                    >
                      <div className="acoustic-value">
                        {[1480, 1525, 1498][i]} <small>µs echo time</small>
                      </div>
                      <div className="detail-row">
                        <span>Sample amplitude</span>
                        <strong>{[0.42, 0.37, 0.46][i]} a.u.</strong>
                      </div>
                      <div className="detail-row">
                        <span>Valid returns</span>
                        <strong>{[92, 85, 96][i]} / 100</strong>
                      </div>
                      <div className="detail-row">
                        <span>Data quality</span>
                        <Badge tone={i === 1 ? "amber" : "teal"}>
                          {i === 1 ? "Noisy" : "Usable sample"}
                        </Badge>
                      </div>
                      <p className="disclaimer">
                        Synthetic raw measurement. Device calibration and
                        environmental interference remain unassessed.
                      </p>
                    </Panel>
                  ))}
              </div>
              <Panel
                title="Research annotations"
                subtitle="Optional observations"
              >
                <p className="empty">
                  No field observations recorded. Real acoustic records and
                  researcher annotations will be added with backend integration.
                </p>
              </Panel>
            </>
          )}
          {section === "pump-control" && (
            <div className="main-grid equal">
              <PumpPanel expanded />
              <Panel title="Control safety" subtitle="Architecture preview">
                <div className="prose">
                  <ShieldCheck className="teal" size={30} />
                  <h3>Simulation only</h3>
                  <p>
                    Commands are held in this browser session and reset when the
                    page reloads. Acknowledgments are generated locally, not
                    received from an ESP32.
                  </p>
                  <h3>Required production safeguards</h3>
                  <p>
                    Administrator authentication, server authorization, fresh
                    gateway heartbeat, low-water and low-battery interlocks,
                    command expiration, and physical manual override.
                  </p>
                  <p>
                    Device-reported execution must remain distinct from
                    requested state. No real control endpoint exists in Phase 1.
                  </p>
                </div>
              </Panel>
            </div>
          )}
          {section === "power-monitoring" && (
            <>
              <div className="main-grid equal">
                <PowerPanel />
                <Panel
                  title="Power topology"
                  subtitle="Separate gateway and node power domains"
                >
                  <div className="prose">
                    <Sun size={30} className="amber" />
                    <h3>Solar-powered central gateway</h3>
                    <p>
                      Solar input charges the gateway battery. Gateway battery
                      monitoring and pump relay control share the central
                      controller.
                    </p>
                    <h3>Six battery-powered monitoring nodes</h3>
                    <p>
                      Node battery status is tracked individually. Solar data
                      does not describe the monitoring nodes.
                    </p>
                  </div>
                </Panel>
              </div>
              <Panel
                title="Monitoring-node batteries"
                subtitle="Simulated percentages · offline values may be outdated"
              >
                <div className="coverage-grid">
                  {nodes.map((n) => (
                    <div key={n.id}>
                      <strong>{n.name}</strong>
                      <span className={n.battery < 25 ? "amber" : "teal"}>
                        {n.battery}%
                      </span>
                      <div className="progress">
                        <span style={{ width: `${n.battery}%` }} />
                      </div>
                      <p>
                        {n.status === "online"
                          ? "Fresh sample"
                          : "Last known sample"}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
          {section === "alerts" && (
            <>
              <AlertsPanel />
              <Panel
                title="Notification preferences"
                subtitle="Preview controls"
              >
                <div className="prose">
                  <p>
                    Alerts shown here are fixed simulation events. Delivery,
                    persistence, acknowledgment, and threshold configuration
                    require the authenticated backend.
                  </p>
                  <button
                    onClick={() =>
                      setNotice(
                        "Sample events reviewed locally. No server-side acknowledgment was recorded.",
                      )
                    }
                  >
                    Review sample events
                  </button>
                  {notice && (
                    <p role="status" className="teal">
                      {notice}
                    </p>
                  )}
                </div>
              </Panel>
            </>
          )}
          {section === "settings" && (
            <div className="main-grid equal">
              <Panel
                title="Workspace settings"
                subtitle="Phase 1 · read-only configuration"
              >
                <div className="detail-row">
                  <span>Workspace</span>
                  <strong>Research pond A</strong>
                </div>
                <div className="detail-row">
                  <span>Data source</span>
                  <Badge tone="blue">Simulation</Badge>
                </div>
                <div className="detail-row">
                  <span>Units</span>
                  <strong>Celsius · meters · volts</strong>
                </div>
                <div className="detail-row">
                  <span>Authentication</span>
                  <strong>Not connected</strong>
                </div>
                <div className="detail-row">
                  <span>Realtime</span>
                  <strong>Not connected</strong>
                </div>
                <p className="disclaimer">
                  The administrator profile is illustrative. No protected user
                  data or device credentials are present.
                </p>
              </Panel>
              <Panel
                title="Integration roadmap"
                subtitle="After Phase 1 review"
              >
                <div className="prose">
                  <h3>Supabase & device boundary</h3>
                  <p>
                    Add PostgreSQL relationships, constraints, indexes,
                    administrator Auth, and Row Level Security before exposing
                    real records.
                  </p>
                  <p>
                    Separate server-only telemetry ingestion and device
                    credentials from user sessions. Add authenticated pump
                    command APIs and durable acknowledgment audit trails.
                  </p>
                  <p>
                    Subscribe to authorized telemetry and status updates through
                    Supabase Realtime. Never ship service-role keys to browser
                    code.
                  </p>
                </div>
              </Panel>
            </div>
          )}
          <footer className="footer">
            <span>
              <Waves size={14} /> SPAMS-S <span>·</span> Smart Pond Aquaculture
              Monitoring System-Swarm
            </span>
            <span>
              <FlaskConical size={13} /> Phase 1 · Research prototype
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
