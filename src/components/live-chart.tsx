"use client";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { hourlyWindow, type Observation } from "@/lib/dashboard";
export function LiveChart({
  observations,
  level = false,
  now,
}: {
  observations: Observation[];
  level?: boolean;
  now: number;
}) {
  const [range, setRange] = useState(24);
  const data = useMemo(
    () => hourlyWindow(observations, now, range),
    [observations, now, range],
  );
  return (
    <>
      <div className="chart-toolbar">
        <span className="legend">Hourly mean · equal node weighting · UTC</span>
        <div className="segmented">
          {[6, 12, 24].map((r) => (
            <button
              key={r}
              aria-pressed={r === range}
              onClick={() => setRange(r)}
              className={r === range ? "selected" : ""}
            >
              {r}h
            </button>
          ))}
        </div>
      </div>
      {data.some((p) => p[level ? "level" : "temperature"] !== null) ? (
        <div className="chart" style={{ height: 245 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid
                stroke="#253342"
                strokeDasharray="3 5"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "#8191a6", fontSize: 10 }}
                minTickGap={35}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#8191a6", fontSize: 10 }}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  background: "#142132",
                  border: "1px solid #334455",
                }}
              />
              <Area
                dataKey={level ? "level" : "temperature"}
                stroke={level ? "#73b8fa" : "#39d3b5"}
                fill={level ? "#23405b" : "#163e3a"}
                connectNulls={false}
                dot={{ r: 2, fill: level ? "#73b8fa" : "#39d3b5" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="empty">
          No valid historical readings. Gaps are not filled with simulated
          values.
        </p>
      )}
    </>
  );
}
