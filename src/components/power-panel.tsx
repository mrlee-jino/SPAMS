"use client";
import { Battery, Sun, Zap } from "lucide-react";
import { Panel } from "./ui";
export function PowerPanel() {
  return (
    <Panel
      title="Gateway power"
      subtitle="Central ESP32 · solar-powered"
      action={<Sun className="amber" size={19} />}
    >
      <div className="power-summary">
        <div className="battery-visual">
          <Battery size={46} />
        </div>
        <div>
          <strong>
            84<span>%</span>
          </strong>
          <p className="teal">
            <Zap size={12} /> Charging · simulated
          </p>
        </div>
      </div>
      <div className="progress">
        <span style={{ width: "84%" }} />
      </div>
      <div className="power-grid">
        <div>
          <span>Battery voltage</span>
          <strong>
            12.8 <small>V</small>
          </strong>
        </div>
        <div>
          <span>Solar input</span>
          <strong>
            18.4 <small>W</small>
          </strong>
        </div>
        <div>
          <span>Panel voltage</span>
          <strong>
            17.6 <small>V</small>
          </strong>
        </div>
        <div>
          <span>Charge current</span>
          <strong>
            1.4 <small>A</small>
          </strong>
        </div>
      </div>
      <p className="disclaimer">
        Sample power values. Solar fields may be unavailable on real hardware.
      </p>
    </Panel>
  );
}
