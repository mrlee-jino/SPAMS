"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Waves,
  RefreshCw,
  ShieldCheck,
  Radio,
  Thermometer,
  Droplets,
  Battery,
} from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import {
  ageLabel,
  freshness,
  FULL_WATER_LEVEL_RAW,
  waterLevelPercentFromRaw,
  type DashboardSnapshot,
} from "@/lib/dashboard";
import { Badge, Panel } from "./ui";
import { LiveChart } from "./live-chart";
import { NodeHistory } from "./node-history";
import { TelemetryExport } from "./telemetry-export";
import {
  SIMULATED_GATEWAY_BATTERY_PERCENT,
  SIMULATED_GATEWAY_BATTERY_VOLTAGE,
  useSimulatedPanelVoltage,
} from "./use-simulated-power";
const tabs = [
  "Overview",
  "Nodes",
  "Analytics",
  "Predictions",
  "Hydroacoustics",
  "Power",
  "Alerts",
  "Settings",
] as const;
type Tab = (typeof tabs)[number];
const expectedAcousticProfile = [
  { slot: 1, echoUs: 1480, amplitude: 0.4, validReturns: 90 },
  { slot: 2, echoUs: 1492, amplitude: 0.4, validReturns: 90 },
] as const;
export function LiveWorkspace() {
  const [tab, setTab] = useState<Tab>("Overview");
  const panelVoltage = useSimulatedPanelVoltage();
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
  }, [selection]);
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
      "alerts",
      "forecasts",
    ];
    let channel = supabase.channel("public-pond-records");
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
  const nodeOne = snapshot?.nodes.find((n) => n.slot === 1);
  const nodeOneSample = readings.find((r) => r.node_id === nodeOne?.id);
  const showExpectedAcousticProfile =
    freshness(nodeOneSample?.sampled_at ?? null, now) === "online";
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
        <Link className="live-brand" href="/">
          <Waves className="teal" /> SPAMS-S <small>PUBLIC MONITORING</small>
        </Link>
        <div className="live-actions">
          <Link href="/demo" className="text-link">
            Simulated preview
          </Link>
        </div>
      </header>
      <main className="live-main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">PUBLIC · READ-ONLY MONITORING</div>
            <h1>{activeNode ? activeNode.label : tab}</h1>
            <p>{snapshot?.pond?.name ?? "Your research workspace"}</p>
          </div>
          <button onClick={() => void refresh()} disabled={busy}>
            <RefreshCw size={14} />
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="live-status">
          <span>
            <ShieldCheck size={14} /> Public data · controls disabled
          </span>
          <span>Realtime: {connection}</span>
          <span>
            {snapshot
              ? `Fetched ${ageLabel(snapshot.fetchedAt, now)}`
              : "Loading database records…"}
          </span>
        </div>
        {gateway?.data_source === "simulation" && (
          <div className="simulation-banner" role="status">
            <strong>Simulated gateway telemetry</strong>
            <span>
              These database records were generated by the software simulator,
              not measured by physical sensors.
            </span>
          </div>
        )}
        <nav className="live-tabs" aria-label="Public monitoring">
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
            Loading public pond records…
          </p>
        )}
        {snapshot && !snapshot.pond && (
          <Panel
            title="No public pond registered yet"
            subtitle="No sign-in required"
          >
            <p className="empty">
              The project owner needs to provision a public pond. No simulated
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
                    const levelPercent = waterLevelPercentFromRaw(
                      reading?.water_level_raw,
                    );
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
                            <span className="pond-level-label">
                              <Droplets size={13} /> Pond level
                            </span>
                            <strong>
                              {levelPercent ?? "—"}
                              <small>{levelPercent === null ? "" : "%"}</small>
                            </strong>
                            <div
                              className={`pond-level-gauge${levelPercent === null ? " unavailable" : ""}`}
                              role="img"
                              aria-label={
                                levelPercent === null
                                  ? "Pond level unavailable; no raw sensor reading"
                                  : `Estimated pond fullness ${levelPercent} percent; full reference is 1500 ADC counts`
                              }
                              title="Estimated from raw ADC; 1500 counts represents full"
                            >
                              <span
                                style={{
                                  width: `${levelPercent ?? 0}%`,
                                }}
                              />
                            </div>
                            <small className="pond-level-raw">
                              {reading?.water_level_raw == null
                                ? "No raw reading"
                                : `${reading.water_level_raw} / ${FULL_WATER_LEVEL_RAW} ADC`}
                            </small>
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
                    {(() => {
                      const reading = readings.find(
                        (r) => r.node_id === activeNode.id,
                      );
                      return (
                        <div className="prose">
                          <p>
                            Temperature: {reading?.temperature_c ?? "—"} °C ·
                            calibrated water level:{" "}
                            {reading?.water_level_m ?? "—"} m
                          </p>
                          <p>
                            pH: {reading?.ph_value ?? "—"} · TDS:{" "}
                            {reading?.tds_ppm ?? "—"} ppm
                          </p>
                          <p>
                            Turbidity: {reading?.turbidity_voltage ?? "—"} V ·{" "}
                            {reading?.turbidity_ntu ?? "—"} NTU
                          </p>
                          <p>
                            Raw water-level ADC:{" "}
                            {reading?.water_level_raw ?? "—"} counts (not
                            calibrated to meters)
                          </p>
                          <p>
                            Battery: {reading?.battery_percent ?? "Unavailable"}
                            % · sensor health:{" "}
                            {reading?.sensor_health ?? "No sensor data"}.
                          </p>
                          <p>
                            Latest sample received:{" "}
                            {reading?.received_at ?? "No heartbeat received"}.
                          </p>
                        </div>
                      );
                    })()}
                    <p className="prose">
                      Ultrasonic capability:{" "}
                      {activeNode.ultrasonic_enabled
                        ? "Experimental sensor enabled"
                        : "Not installed"}
                    </p>
                    <NodeHistory
                      observations={snapshot.history.filter(
                        (r) => r.node_id === activeNode.id,
                      )}
                    />
                  </Panel>
                )}
              </>
            )}
            {(tab === "Overview" || tab === "Analytics") && (
              <>
                <TelemetryExport gatewayId={gateway.id} />
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
                    {snapshot.forecast.evaluation && (
                      <p>
                        Rolling evaluation:{" "}
                        {snapshot.forecast.evaluation.samples} holdouts.{" "}
                        {snapshot.forecast.evaluation.model &&
                        snapshot.forecast.evaluation.persistence
                          ? `Model MAE ${snapshot.forecast.evaluation.model.mae.toFixed(3)} °C, RMSE ${snapshot.forecast.evaluation.model.rmse.toFixed(3)} °C; persistence MAE ${snapshot.forecast.evaluation.persistence.mae.toFixed(3)} °C.`
                          : "Not enough historical holdouts for error metrics."}{" "}
                        Not independent field validation.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="empty">
                    No eligible forecast is stored yet. The processor needs six
                    consecutive completed hours with at least four healthy
                    temperature nodes per hour.
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
                {showExpectedAcousticProfile && (
                  <Panel
                    title="Expected two-node reference profile"
                    subtitle="Illustrative study reference · available only while real Node 1 is fresh"
                  >
                    <p className="disclaimer">
                      These expected values are not sensor readings and are
                      shown separately from observed telemetry.
                    </p>
                    <div className="nodes-grid">
                      {expectedAcousticProfile.map((profile) => {
                        const node = snapshot.nodes.find(
                          (candidate) => candidate.slot === profile.slot,
                        );
                        return (
                          <Panel
                            key={profile.slot}
                            title={node?.label ?? `Node ${profile.slot}`}
                            subtitle="Expected reference values"
                          >
                            <div className="prose">
                              <p>Echo time: {profile.echoUs} µs</p>
                              <p>
                                Amplitude: {profile.amplitude.toFixed(2)} a.u.
                              </p>
                              <p>
                                Valid returns: {profile.validReturns}/100
                              </p>
                            </div>
                          </Panel>
                        );
                      })}
                    </div>
                  </Panel>
                )}
                {!showExpectedAcousticProfile && (
                  <p className="empty">
                    The expected two-node reference profile is hidden until
                    real Node 1 telemetry is fresh.
                  </p>
                )}
              </>
            )}
            {tab === "Power" && (
              <>
                <Panel
                  title="Gateway power"
                  subtitle="Central gateway · sample simulation"
                >
                  <div className="power-grid">
                    {[
                      [
                        "Battery",
                        SIMULATED_GATEWAY_BATTERY_PERCENT,
                        "%",
                      ],
                      ["Battery voltage", SIMULATED_GATEWAY_BATTERY_VOLTAGE, "V"],
                      ["Solar input", panelVoltage.toFixed(2), "V"],
                      ["Panel voltage", panelVoltage.toFixed(2), "V"],
                    ].map(([name, value, unit]) => (
                      <div key={String(name)}>
                        <span>{name}</span>
                        <strong>
                          {value} <small>{unit}</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="disclaimer">
                    Simulated values, not measurements from the ESP32. Solar
                    and panel voltage share one random value, refreshed every
                    10 seconds (3.20–6.00 V). Monitoring nodes have independent
                    batteries.
                  </p>
                </Panel>
                <Panel title="Monitoring-node batteries">
                  <div className="coverage-grid">
                    {snapshot.nodes.map((n) => {
                      const r = readings.find((t) => t.node_id === n.id);
                      const batteryPercent =
                        freshness(r?.sampled_at ?? null, now) === "online"
                          ? 100
                          : 0;
                      return (
                        <div key={n.id}>
                          <strong>{n.label}</strong>
                          <span>{batteryPercent}%</span>
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
                      No stored alerts. Rules are evaluated when the research
                      processor runs.
                    </p>
                  )}
                </Panel>
              </>
            )}
            {tab === "Settings" && (
              <Panel
                title="Workspace configuration"
                subtitle="Public read-only deployment information"
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
                    Public access: read-only PostgreSQL policies. No sign-in is
                    required.
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
            SPAMS-S · Public monitoring ·{" "}
            {gateway?.data_source === "simulation"
              ? "simulated gateway records"
              : "hardware records only"}
          </span>
        </footer>
      </main>
    </div>
  );
}
