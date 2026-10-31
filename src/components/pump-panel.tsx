"use client";
import { useState } from "react";
import { Droplets, ShieldCheck, Zap } from "lucide-react";
import { Badge, Panel } from "./ui";
interface Command {
  id: number;
  action: string;
  state: "Acknowledged (simulation)" | "Pending simulation";
  time: string;
}
export function PumpPanel({ expanded = false }: { expanded?: boolean }) {
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);
  function execute() {
    setRunning(!running);
    setCommands((c) => [
      {
        id: Date.now(),
        action: running ? "Stop pump" : "Start pump",
        state: "Acknowledged (simulation)",
        time: new Date().toLocaleTimeString(),
      },
      ...c,
    ]);
    setConfirm(false);
  }
  return (
    <Panel
      title="Water pump"
      subtitle="Gateway relay · demonstration only"
      action={
        <Badge tone={running ? "teal" : "gray"}>
          {running ? "Running" : "Standby"}
        </Badge>
      }
    >
      <div className="pump-body">
        <div className={`pump-icon ${running ? "running" : ""}`}>
          <Droplets size={30} />
        </div>
        <div>
          <h3>{running ? "Simulated pump running" : "Ready when needed"}</h3>
          <p>No physical relay is connected.</p>
        </div>
      </div>
      <div className="safety">
        <ShieldCheck size={15} />
        <span>Sample interlocks: water level & battery OK</span>
      </div>
      <button className="primary full" onClick={() => setConfirm(true)}>
        <Zap size={15} />
        {running ? "Stop simulated pump" : "Start simulated pump"}
      </button>
      {confirm && (
        <div className="confirmation" role="alert">
          <strong>{running ? "Stop" : "Start"} simulated pump?</strong>
          <p>
            This changes local UI state only. No command is sent to a device.
          </p>
          <div>
            <button className="primary" onClick={execute}>
              Confirm simulation
            </button>
            <button onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
      {expanded && (
        <div className="command-list">
          <h3>Session command history</h3>
          {commands.length === 0 ? (
            <p className="empty">
              No simulated commands yet. Try the control above.
            </p>
          ) : (
            commands.map((c) => (
              <div className="command" key={c.id}>
                <span>
                  {c.action}
                  <small>{c.time} · local session only</small>
                </span>
                <Badge>{c.state}</Badge>
              </div>
            ))
          )}
          <p className="disclaimer">
            Production requires authorization, expiry, idempotency, interlock
            checks, device acknowledgments and an immutable server-side audit
            trail.
          </p>
        </div>
      )}
    </Panel>
  );
}
