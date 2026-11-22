"use client";

import { useEffect, useState } from "react";

export const SIMULATED_GATEWAY_BATTERY_PERCENT = 95;
export const SIMULATED_GATEWAY_BATTERY_VOLTAGE = 3.8;

export function useSimulatedPanelVoltage() {
  const [voltage, setVoltage] = useState(4.6);

  useEffect(() => {
    const updateVoltage = () => {
      setVoltage(3.2 + Math.floor(Math.random() * 281) / 100);
    };
    updateVoltage();
    const timer = setInterval(updateVoltage, 10000);
    return () => clearInterval(timer);
  }, []);

  return voltage;
}
