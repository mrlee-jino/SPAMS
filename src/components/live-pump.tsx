"use client";
import { useState } from "react";
import { Badge, Panel } from "./ui";
import type { Gateway, PumpCommand, CommandEvent } from "@/lib/dashboard";
import { freshness } from "@/lib/dashboard";
export function LivePump({
  gateway,
  commands,
  events,
  onRefresh,
  now,
}: {
  gateway: Gateway;
  commands: PumpCommand[];
  events: CommandEvent[];
  onRefresh: () => void;
  now: number;
}) {
  const [confirm, setConfirm] = useState<"start" | "stop" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Reuse the same request key after uncertain transport failures; never duplicate a command on retry.
  const [pending, setPending] = useState<{
    key: string;
    action: "start" | "stop";
  } | null>(null);
  const online = freshness(gateway.last_seen_at, now) === "online";
  async function submit() {
    if (!confirm || busy) return;
    setBusy(true);
    setMessage("");
    const request = pending ?? { key: crypto.randomUUID(), action: confirm };
    setPending(request);
    try {
      const response = await fetch("/api/pump-commands", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gatewayId: gateway.id,
          action: request.action,
          idempotencyKey: request.key,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) setPending(null);
        throw new Error(result.error ?? "Command request failed.");
      }
      setPending(null);
      setConfirm(null);
      setMessage(
        "Command recorded. Device execution is not confirmed until its acknowledgment is received.",
      );
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Pump command center"
      subtitle="Durable server-side requests · device execution is separate"
      action={
        <Badge tone={online ? "teal" : "amber"}>
          {online ? "Gateway reporting" : "Gateway stale/offline"}
        </Badge>
      }
    >
      <div className="prose">
        <div className="detail-row">
          <span>Last device-reported pump state</span>
          <strong>{gateway.pump_state}</strong>
        </div>
        <p>
          Physical command delivery is{" "}
          {gateway.control_enabled ? "enabled" : "disabled"}. Start requires six
          fresh, healthy water-level readings, gateway battery above its
          configured minimum, and no unresolved command.
        </p>
        <p>
          Minimum water level: {gateway.min_water_level_m} m · minimum battery:{" "}
          {gateway.min_battery_percent}%. Firmware must independently enforce
          interlocks and provide a manual override.
        </p>
        <div className="live-actions">
          <button
            className="primary"
            disabled={!gateway.control_enabled || !online || busy || !!pending}
            onClick={() => setConfirm("start")}
          >
            Request pump start
          </button>
          <button
            disabled={!gateway.control_enabled || !online || busy || !!pending}
            onClick={() => setConfirm("stop")}
          >
            Request pump stop
          </button>
        </div>
      </div>
      {confirm && (
        <div className="confirmation" role="alert">
          <strong>Request physical pump {confirm}?</strong>
          <p>
            This can affect a real relay when a commissioned gateway is
            connected. The server checks interlocks again before accepting and
            delivering the request.
          </p>
          <button className="primary" disabled={busy} onClick={submit}>
            {busy
              ? "Submitting…"
              : pending
                ? "Retry same request"
                : "Confirm request"}
          </button>
          <button disabled={busy || !!pending} onClick={() => setConfirm(null)}>
            Cancel
          </button>
          {pending && (
            <p>
              Delivery is uncertain. Retry this same request to resolve it; do
              not create a replacement command.
            </p>
          )}
        </div>
      )}
      {message && (
        <p className="request-message" role="status">
          {message}
        </p>
      )}
      <div className="command-list">
        <h3>Recent commands</h3>
        {!commands.length ? (
          <p className="empty">No commands have been requested.</p>
        ) : (
          commands.map((c) => (
            <div key={c.id} className="command">
              <span>
                {c.action} · {c.id.slice(0, 8)}
                <small>
                  {new Date(c.requested_at).toLocaleString()} · expires{" "}
                  {new Date(c.expires_at).toLocaleTimeString()}
                </small>
                {["delivered", "acknowledged"].includes(c.status) &&
                  Date.parse(c.expires_at) < now && (
                    <small className="amber">
                      Execution unknown after timeout. Reconcile physically; do
                      not infer success.
                    </small>
                  )}
              </span>
              <Badge tone={c.status === "completed" ? "teal" : "amber"}>
                {c.status}
              </Badge>
            </div>
          ))
        )}
      </div>
      <div className="prose">
        <h3>Audit events</h3>
        {events.length ? (
          events.map((e) => (
            <p key={e.id}>
              {new Date(e.created_at).toLocaleString()} ·{" "}
              {e.command_id.slice(0, 8)} · {e.event}
            </p>
          ))
        ) : (
          <p>No command events recorded.</p>
        )}
      </div>
    </Panel>
  );
}
