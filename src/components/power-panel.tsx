"use client";
import { Battery, Sun } from "lucide-react";
import { Panel } from "./ui";
import {
  SIMULATED_GATEWAY_BATTERY_PERCENT,
  SIMULATED_GATEWAY_BATTERY_VOLTAGE,
  useSimulatedPanelVoltage,
} from "./use-simulated-power";

export function PowerPanel() {
  const panelVoltage = useSimulatedPanelVoltage();
  return (
    <Panel
      title="Gateway power"
      subtitle="Central ESP32 · readings"
      action={<Sun className="amber" size={19} />}
    >
      <div className="power-summary">
        <div className="battery-visual">
          <Battery size={46} />
        </div>
        <div>
          <strong>
            {SIMULATED_GATEWAY_BATTERY_PERCENT}
            <span>%</span>
          </strong>
          <p className="teal">Fixed demonstration value</p>
        </div>
      </div>
      <div className="progress">
        <span style={{ width: `${SIMULATED_GATEWAY_BATTERY_PERCENT}%` }} />
      </div>
      <div className="power-grid">
        <div>
          <span>Battery voltage</span>
          <strong>
            {SIMULATED_GATEWAY_BATTERY_VOLTAGE.toFixed(1)} <small>V</small>
          </strong>
        </div>
        <div>
          <span>Solar input</span>
          <strong>
            {panelVoltage.toFixed(2)} <small>V</small>
          </strong>
        </div>
        <div>
          <span>Panel voltage</span>
          <strong>
            {panelVoltage.toFixed(2)} <small>V</small>
          </strong>
        </div>
        <div>
          <span>Next voltage update</span>
          <strong>10 <small>s interval</small></strong>
        </div>
      </div>
      <p className="disclaimer">
        
      </p>
    </Panel>
  );
}
