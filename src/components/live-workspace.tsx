"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Waves,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Radio,
  Thermometer,
  Droplets,
  Battery,
} from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { ageLabel, freshness, type DashboardSnapshot } from "@/lib/dashboard";
import { signOut } from "@/app/login/actions";
import { Badge, Panel } from "./ui";
import { LiveChart } from "./live-chart";
import { LivePump } from "./live-pump";
const tabs = [
  "Overview",
  "Nodes",
  "Analytics",
  "Predictions",
  "Hydroacoustics",
  "Pump control",
  "Power",
  "Alerts",
  "Settings",
] as const;
type Tab = (typeof tabs)[number];
export function LiveWorkspace({ email }: { email: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [connection, setConnection] = useState("Connecting");
  const [clock, setClock] = useState(0);
  const [selection, setSelection] = useState({ pond: "", gateway: "" });
  const [nodeId, setNodeId] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const run = ++generation.current;
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (selection.pond) params.set("pond", selection.pond);
      if (selection.gateway) params.set("gateway", selection.gateway);
      const response = await fetch("/api/dashboard?" + params, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Unable to load pond records.");
      if (run === generation.current) {
        setSnapshot(result as DashboardSnapshot);
        setError("");
        setClock(Date.now());
      }
    } catch (e) {
      if (run === generation.current)
        setError(e instanceof Error ? e.message : "Connection unavailable.");
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }, [selection, router]);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 30000);
    const tick = setInterval(() => setClock(Date.now()), 5000);
    const reconnect = () => void refresh();
    window.addEventListener("online", reconnect);
    return () => {
      invalidate();
      clearTimeout(initial);
      clearInterval(timer);
      clearInterval(tick);
      window.removeEventListener("online", reconnect);
    };
  }, [refresh, invalidate]);
  useEffect(() => {
    const supabase = browserSupabase();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const tables = [
      "gateways",
      "nodes",
      "node_telemetry",
      "gateway_telemetry",
      "acoustic_samples",
      "pump_commands",
      "command_events",
      "alerts",
      "forecasts",
    ];
    let channel = supabase.channel("authorized-pond-records");
    for (const table of tables)
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => void refresh(), 500);
        },
      );
    channel.subscribe((status) =>
      setConnection(
        status === "SUBSCRIBED"
          ? "Connected"
          : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
            ? "Disconnected · polling every 30s"
            : status === "CLOSED"
              ? "Disconnected"
              : "Connecting",
      ),
    );
    return () => {
      clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);
  const now = clock;
  const gateway = snapshot?.gateway;
  const activeNode = snapshot?.nodes.find((n) => n.id === nodeId);
  const readings = useMemo(() => snapshot?.latest ?? [], [snapshot]);
  const valid = readings.filter(
    (t) =>
      freshness(t.sampled_at, now) === "online" &&
      t.sensor_health === "healthy",
  );
  const mean = (key: "temperature_c" | "water_level_m") => {
    const values = valid
      .map((v) => v[key])
      .filter((v): v is number => v !== null);
    return values.length
      ? (values.reduce((a, b) => a + Number(b), 0) / values.length).toFixed(
          key === "temperature_c" ? 1 : 2,
        )
      : "—";
  };
  const choose = (next: Tab) => {
    setTab(next);
    setNodeId(null);
  };
  return (
    <div className="live-shell">
      <header className="live-header">
        <Link className="live-brand" href="/live">
          <Waves className="teal" /> SPAMS-S <small>ADMIN WORKSPACE</small>
        </Link>
        <div className="live-actions">
          <Link href="/" className="text-link">
            Simulated preview
          </Link>
          <form action={signOut}>
            <button>
              <LogOut size={14} /> Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="live-main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">AUTHENTICATED · DATABASE RECORDS</div>
            <h1>{activeNode ? activeNode.label : tab}</h1>
            <p>
              {snapshot?.pond?.name ?? "Your research workspace"} · {email}
            </p>
          </div>
          <button onClick={() => void refresh()} disabled={busy}>
            <RefreshCw size={14} />
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="live-status">
          <span>
            <ShieldCheck size={14} /> Access scoped by pond membership
          </span>
          <span>Realtime: {connection}</span>
          <span>
            {snapshot
              ? `Fetched ${ageLabel(snapshot.fetchedAt, now)}`
              : "Loading database records…"}
          </span>
        </div>
        <nav className="live-tabs" aria-label="Administrator workspace">
          {tabs.map((t) => (
            <button
              key={t}
              className={t === tab ? "selected" : ""}
              aria-current={t === tab ? "page" : undefined}
              onClick={() => choose(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        {snapshot?.ponds.length ? (
          <div className="workspace-controls">
            <label>
              Pond
              <select
                value={snapshot.pond?.id ?? ""}
                onChange={(e) => {
                  setSnapshot(null);
                  setNodeId(null);
                  setSelection({ pond: e.target.value, gateway: "" });
                }}
              >
                {snapshot.ponds.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {snapshot.gateways.length > 0 && (
              <label>
                Gateway
                <select
                  value={gateway?.id ?? ""}
                  onChange={(e) => {
                    setSnapshot(null);
                    setNodeId(null);
                    setSelection({
                      pond: snapshot.pond!.id,
                      gateway: e.target.value,
                    });
                  }}
                >
                  {snapshot.gateways.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ) : null}
        {error && (
          <div className="info-box" role="alert">
            <div>
              <strong>
                {snapshot
                  ? "Refresh failed · displayed records may be outdated"
                  : "Unable to load workspace"}
              </strong>
              <p>{error}</p>
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          </div>
        )}
        {busy && !snapshot && !error && (
          <p className="empty" role="status">
            Loading authorized pond records…
          </p>
        )}
        {snapshot && !snapshot.pond && (
          <Panel title="No pond access yet" subtitle="Signed in successfully">
            <p className="empty">
              This account has no pond membership. Ask the project owner to
              provision your pond and grant your user access. No simulated
              readings are substituted.
            </p>
          </Panel>
        )}
        {snapshot?.pond && !gateway && (
          <Panel title="No gateway registered">
            <p className="empty">
              Register the central gateway and its six stationary nodes using
              the provisioning instructions. No devices are created
              automatically.
            </p>
          </Panel>
        )}
        {gateway && snapshot && (
          <>
            {(tab === "Overview" || tab === "Nodes") && (
              <>
                <div className="metrics-grid">
                  {[
                    {
                      label: "Fresh mean temperature",
                      value: mean("temperature_c"),
                      unit: "°C",
                      icon: Thermometer,
                    },
                    {
                      label: "Fresh mean water level",
                      value: mean("water_level_m"),
                      unit: "m",
                      icon: Droplets,
                    },
                    {
                      label: "Fresh healthy nodes",
                      value: String(valid.length),
                      unit: `/ ${snapshot.nodes.length}`,
                      icon: Radio,
                    },
                    {
                      label: "Gateway battery",
                      value:
                        gateway.battery_percent === null
                          ? "—"
                          : String(gateway.battery_percent),
                      unit: "%",
                      icon: Battery,
                    },
                  ].map((m) => (
                    <article className="metric" key={m.label}>
                      <div className="metric-top">
                        <span>{m.label}</span>
                        <m.icon size={17} className="teal" />
                      </div>
                      <div className="metric-value">
                        {m.value}
                        <small>{m.unit}</small>
                      </div>
                      <p>
                        {m.label === "Gateway battery"
                          ? `Sample ${ageLabel(gateway.last_sample_at, now)}`
                          : "Only healthy samples ≤90 seconds old"}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="nodes-grid">
                  {snapshot.nodes.map((n) => {
                    const reading = readings.find((t) => t.node_id === n.id);
                    const status = freshness(reading?.sampled_at ?? null, now);
                    return (
                      <button
                        className="node-card live-node"
                        key={n.id}
                        onClick={() => {
                          setNodeId(n.id);
                          setTab("Nodes");
                        }}
                      >
                        <div className="node-top">
                          <Radio className="teal" size={18} />
                          <div>
                            <h3>{n.label}</h3>
                            <p>{n.position}</p>
                          </div>
                          <Badge
                            tone={
                              status === "online"
                                ? "teal"
                                : status === "stale"
                                  ? "amber"
                                  : "gray"
                            }
                          >
                            {status}
                          </Badge>
                        </div>
                        <div className="node-readings">
                          <div>
                            <span>Temperature</span>
                            <strong>
                              {reading?.temperature_c ?? "—"}
                              <small> °C</small>
                            </strong>
                          </div>
                          <div>
                            <span>Water level</span>
                            <strong>
                              {reading?.water_level_m ?? "—"}
                              <small> m</small>
                            </strong>
                          </div>
                        </div>
                        <div className="node-footer">
                          <span>
                            {ageLabel(reading?.sampled_at ?? null, now)}
                          </span>
                          <span>
                            {reading?.sensor_health ?? "No sensor data"}
                          </span>
                        </div>
                        {status !== "online" && reading && (
                          <p className="stale-note">
                            Last known sample · excluded from fresh mean
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!snapshot.nodes.length && (
                  <p className="empty">
                    No monitoring nodes have been registered.
                  </p>
                )}
                {activeNode && (
                  <Panel
                    title={`${activeNode.label} details`}
                    subtitle={`${activeNode.position} · node ${activeNode.slot}`}
                  >
                    <div className="prose">
                      <p>
                        Ultrasonic capability:{" "}
                        {activeNode.ultrasonic_enabled
                          ? "Experimental sensor enabled"
                          : "Not installed"}
                      </p>
                      <p>
                        Battery:{" "}
                        {readings.find((r) => r.node_id === activeNode.id)
                          ?.battery_percent ?? "Unavailable"}
                        % · sample timestamp determines freshness.
                      </p>
                      <p>
                        Latest sample received:{" "}
                        {readings.find((r) => r.node_id === activeNode.id)
                          ?.received_at ?? "No heartbeat received"}
                        .
                      </p>
                    </div>
                    <LiveChart
                      now={now}
                      observations={snapshot.history.filter(
                        (r) => r.node_id === activeNode.id,
                      )}
                    />
                    <LiveChart
                      now={now}
                      observations={snapshot.history.filter(
                        (r) => r.node_id === activeNode.id,
                      )}
                      level
                    />
                  </Panel>
                )}
              </>
            )}
            {(tab === "Overview" || tab === "Analytics") && (
              <>
                {snapshot.historyTruncated && (
                  <div className="info-box">
                    Showing only the latest 1,000 observations in the last 24
                    hours. Charts represent partial coverage; export or
                    paginated research queries are required for complete
                    analysis.
                  </div>
                )}
                <div className="main-grid equal">
                  <Panel
                    title="Water temperature"
                    subtitle="Database observations · last 24 hours"
                  >
                    <LiveChart now={now} observations={snapshot.history} />
                  </Panel>
                  <Panel
                    title="Water level"
                    subtitle="Database observations · last 24 hours"
                  >
                    <LiveChart
                      now={now}
                      observations={snapshot.history}
                      level
                    />
                  </Panel>
                </div>
              </>
            )}
            {tab === "Predictions" && (
              <Panel
                title="One-hour temperature forecast"
                subtitle="Stored model output · no synthetic fallback"
              >
                {snapshot.forecast ? (
                  <div className="prose">
                    <div className="forecast-number">
                      {Number(
                        snapshot.forecast.predicted_temperature_c,
                      ).toFixed(1)}
                      <span>°C</span>
                    </div>
                    <p>
                      Target:{" "}
                      {new Date(snapshot.forecast.target_at).toLocaleString()} ·{" "}
                      {Date.parse(snapshot.forecast.target_at) < now
                        ? "Past target — do not use as a current forecast"
                        : "Upcoming target"}
                    </p>
                    <p>
                      Model: {snapshot.forecast.model_version} ·{" "}
                      {snapshot.forecast.valid_nodes} valid nodes
                    </p>
                    <p>
                      Training:{" "}
                      {new Date(
                        snapshot.forecast.training_start,
                      ).toLocaleString()}{" "}
                      –{" "}
                      {new Date(
                        snapshot.forecast.training_end,
                      ).toLocaleString()}
                    </p>
                    <p>
                      Generated:{" "}
                      {new Date(
                        snapshot.forecast.generated_at,
                      ).toLocaleString()}
                      . Forecast accuracy requires field evaluation.
                    </p>
                  </div>
                ) : (
                  <p className="empty">
                    No model output has been stored. The simulated preview
                    demonstrates Linear Regression; a validated production
                    forecast job is not enabled.
                  </p>
                )}
              </Panel>
            )}
            {tab === "Hydroacoustics" && (
              <>
                <div className="info-box">
                  Experimental ultrasonic observations only. These measurements
                  are not validated fish-activity estimates or fish disease
                  detectors.
                </div>
                <div className="nodes-grid">
                  {snapshot.nodes
                    .filter((n) => n.ultrasonic_enabled)
                    .map((n) => {
                      const t = readings.find((r) => r.node_id === n.id),
                        a = snapshot.acoustics.find(
                          (a) => a.telemetry_id === t?.id,
                        );
                      return (
                        <Panel
                          key={n.id}
                          title={n.label}
                          subtitle={`Latest observation · ${ageLabel(t?.sampled_at ?? null, now)}`}
                        >
                          {a ? (
                            <div className="prose">
                              <p>Echo time: {a.echo_us} µs</p>
                              <p>Amplitude: {a.amplitude} a.u.</p>
                              <p>Valid returns: {a.valid_returns}/100</p>
                              <Badge
                                tone={a.quality === "usable" ? "teal" : "amber"}
                              >
                                {a.quality}
                              </Badge>
                            </div>
                          ) : (
                            <p className="empty">
                              No acoustic reading in the latest sample.
                            </p>
                          )}
                        </Panel>
                      );
                    })}
                </div>
                {!snapshot.nodes.some((n) => n.ultrasonic_enabled) && (
                  <p className="empty">
                    No ultrasonic-enabled nodes are registered.
                  </p>
                )}
              </>
            )}
            {tab === "Pump control" && (
              <LivePump
                key={gateway.id}
                gateway={gateway}
                commands={snapshot.commands}
                events={snapshot.events}
                onRefresh={() => void refresh()}
                now={now}
              />
            )}
            {tab === "Power" && (
              <>
                <Panel
                  title="Gateway power"
                  subtitle={`Last known sample · ${ageLabel(gateway.last_sample_at, now)}`}
                  action={
                    <Badge
                      tone={
                        freshness(gateway.last_sample_at, now) === "online"
                          ? "teal"
                          : "amber"
                      }
                    >
                      {freshness(gateway.last_sample_at, now)}
                    </Badge>
                  }
                >
                  <div className="power-grid">
                    {[
                      ["Battery", gateway.battery_percent, "%"],
                      ["Voltage", gateway.voltage, "V"],
                      ["Solar input", gateway.solar_watts, "W"],
                      ["Panel voltage", gateway.solar_voltage, "V"],
                    ].map(([name, value, unit]) => (
                      <div key={String(name)}>
                        <span>{name}</span>
                        <strong>
                          {value ?? "Unavailable"}{" "}
                          <small>{value !== null ? unit : ""}</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="disclaimer">
                    Charging:{" "}
                    {gateway.charging === null
                      ? "Unknown"
                      : gateway.charging
                        ? "Yes"
                        : "No"}
                    . Monitoring nodes have independent batteries.
                  </p>
                </Panel>
                <Panel title="Monitoring-node batteries">
                  <div className="coverage-grid">
                    {snapshot.nodes.map((n) => {
                      const r = readings.find((t) => t.node_id === n.id);
                      return (
                        <div key={n.id}>
                          <strong>{n.label}</strong>
                          <span>
                            {r?.battery_percent ?? "Unavailable"}
                            {r?.battery_percent !== null &&
                            r?.battery_percent !== undefined
                              ? "%"
                              : ""}
                          </span>
                          <p>{ageLabel(r?.sampled_at ?? null, now)}</p>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </>
            )}
            {tab === "Alerts" && (
              <>
                <Panel
                  title="Connection health"
                  subtitle="Derived from latest sample timestamps"
                >
                  <div className="prose">
                    {snapshot.nodes
                      .filter(
                        (n) =>
                          freshness(
                            readings.find((r) => r.node_id === n.id)
                              ?.sampled_at ?? null,
                            now,
                          ) !== "online",
                      )
                      .map((n) => (
                        <p key={n.id}>
                          {n.label} ·{" "}
                          {freshness(
                            readings.find((r) => r.node_id === n.id)
                              ?.sampled_at ?? null,
                            now,
                          )}
                        </p>
                      ))}
                    <p>
                      Gateway: {freshness(gateway.last_seen_at, now)} ·{" "}
                      {ageLabel(gateway.last_seen_at, now)}
                    </p>
                  </div>
                </Panel>
                <Panel
                  title="Recorded alerts"
                  subtitle="Read-only database alert history"
                >
                  {snapshot.alerts.length ? (
                    snapshot.alerts.map((a) => (
                      <div className="detail-row" key={a.id}>
                        <span>
                          {a.title}
                          <p>
                            {new Date(a.opened_at).toLocaleString()} ·{" "}
                            {a.resolved_at ? "Resolved" : "Open"}
                          </p>
                        </span>
                        <Badge
                          tone={a.severity === "critical" ? "amber" : "blue"}
                        >
                          {a.severity}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="empty">
                      No stored alerts. Automated alert-rule evaluation is not
                      enabled.
                    </p>
                  )}
                </Panel>
              </>
            )}
            {tab === "Settings" && (
              <Panel
                title="Workspace configuration"
                subtitle="Administrator session · read-only deployment settings"
              >
                <div className="prose">
                  <p>Pond ID: {snapshot.pond?.id}</p>
                  <p>Gateway ID: {gateway.id}</p>
                  <p>
                    Hardware control:{" "}
                    {gateway.control_enabled
                      ? "Enabled by project owner"
                      : "Disabled by default"}
                  </p>
                  <p>
                    Authentication: Supabase Auth · access enforced by
                    PostgreSQL Row Level Security.
                  </p>
                  <p>
                    Realtime: {connection}; HTTP refresh every 30 seconds and on
                    reconnect.
                  </p>
                  <p>
                    No service keys or device credentials are available in
                    browser code. Device provisioning and safety limits are
                    managed through the project’s secure administration
                    workflow.
                  </p>
                </div>
              </Panel>
            )}
          </>
        )}
        <footer className="footer">
          <span>
            <Waves size={14} />
            SPAMS-S · Authenticated workspace · no simulated data
          </span>
        </footer>
      </main>
    </div>
  );
}
