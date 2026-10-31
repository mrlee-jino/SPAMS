"use client";
import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { history } from "@/lib/simulation";
export function HistoryChart({
  level = false,
  small = false,
}: {
  level?: boolean;
  small?: boolean;
}) {
  const [range, setRange] = useState("24h");
  const data =
    range === "6h"
      ? history.slice(-6)
      : range === "12h"
        ? history.slice(-12)
        : history;
  return (
    <>
      <div className="chart-toolbar">
        <div className="legend">
          <i style={{ background: level ? "#66b7fa" : "#31d5bc" }} />
          {level ? "Mean water level" : "Pond-wide mean temperature"}{" "}
          <span>· sample series</span>
        </div>
        <div className="segmented" aria-label="History range">
          {["6h", "12h", "24h"].map((r) => (
            <button
              key={r}
              aria-pressed={range === r}
              className={range === r ? "selected" : ""}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="chart" style={{ height: small ? 190 : 245 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 14, right: 12, left: -25, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={level ? "level-fill" : "temp-fill"}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={level ? "#66b7fa" : "#31d5bc"}
                  stopOpacity={0.25}
                />
                <stop offset="100%" stopColor="#31d5bc" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#253342"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fill: "#8191a6", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={level ? [1.18, 1.3] : [26, 30]}
              tick={{ fill: "#8191a6", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#142132",
                border: "1px solid #334455",
                borderRadius: 10,
                color: "#e7eff6",
              }}
              formatter={(v) => [
                `${Number(v).toFixed(2)} ${level ? "m" : "°C"}`,
                level ? "Water level" : "Temperature",
              ]}
            />
            <Area
              type="monotone"
              dataKey={level ? "level" : "temperature"}
              stroke={level ? "#66b7fa" : "#31d5bc"}
              strokeWidth={2.5}
              fill={`url(#${level ? "level-fill" : "temp-fill"})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
