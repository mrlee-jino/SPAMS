"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Observation } from "@/lib/dashboard";

const sensors = [
  { key: "temperature_c", label: "Temperature", unit: "°C", color: "#39d3b5" },
  { key: "water_level_m", label: "Water level", unit: "m", color: "#73b8fa" },
  { key: "water_level_raw", label: "Raw level", unit: "ADC", color: "#b69df8" },
  { key: "ph_value", label: "pH", unit: "", color: "#e7bb67" },
  { key: "tds_ppm", label: "TDS", unit: "ppm", color: "#52c5e8" },
  {
    key: "turbidity_voltage",
    label: "Turbidity voltage",
    unit: "V",
    color: "#ed8eb2",
  },
  { key: "turbidity_ntu", label: "Turbidity", unit: "NTU", color: "#f08d5e" },
  { key: "battery_percent", label: "Node battery", unit: "%", color: "#a9ce75" },
] as const satisfies readonly {
  key: keyof Observation;
  label: string;
  unit: string;
  color: string;
}[];

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampLabel(value: string) {
  return new Date(value).toLocaleString();
}

export function NodeHistory({
  observations,
}: {
  observations: Observation[];
}) {
  const ordered = [...observations].sort(
    (a, b) => Date.parse(b.sampled_at) - Date.parse(a.sampled_at),
  );
  const chartRows = [...ordered]
    .reverse()
    .map((observation) => ({
      ...observation,
      time: new Date(observation.sampled_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  const visibleRows = ordered.slice(0, 20);
  const availableSensors = sensors.filter((sensor) =>
    observations.some(
      (observation) => numericValue(observation[sensor.key]) !== null,
    ),
  );

  return (
    <div className="node-history">
      {visibleRows.length ? (
        <>
          <div className="node-history-table-wrap">
            <table className="node-history-table">
              <thead>
                <tr>
                  <th>Sampled at</th>
                  {sensors.map((sensor) => (
                    <th key={sensor.key}>
                      {sensor.label}
                      {sensor.unit ? ` (${sensor.unit})` : ""}
                    </th>
                  ))}
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((observation) => (
                  <tr key={observation.id}>
                    <td>{timestampLabel(observation.sampled_at)}</td>
                    {sensors.map((sensor) => {
                      const value = numericValue(observation[sensor.key]);
                      return (
                        <td key={sensor.key}>
                          {value === null ? "—" : value}
                        </td>
                      );
                    })}
                    <td>{observation.sensor_health}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="node-history-note">
            Latest {visibleRows.length} readings from the last 24 hours. Charts
            below use the available history for this node.
          </p>
        </>
      ) : (
        <p className="empty">
          No node history is available in the last 24 hours.
        </p>
      )}

      {availableSensors.length > 0 && (
        <div className="node-sensor-charts">
          {availableSensors.map((sensor) => {
            const data = chartRows.flatMap((observation) => {
              const value = numericValue(observation[sensor.key]);
              return value === null
                ? []
                : [
                    {
                      time: observation.time,
                      sampledAt: observation.sampled_at,
                      value,
                    },
                  ];
            });
            return (
              <section className="node-sensor-chart" key={sensor.key}>
                <h3>
                  {sensor.label}
                  {sensor.unit ? ` · ${sensor.unit}` : ""}
                </h3>
                <div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid
                        stroke="#253342"
                        strokeDasharray="3 5"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: "#8191a6", fontSize: 9 }}
                        minTickGap={30}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "#8191a6", fontSize: 9 }}
                        width={38}
                      />
                      <Tooltip
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.sampledAt
                            ? timestampLabel(payload[0].payload.sampledAt)
                            : ""
                        }
                        formatter={(value) => [
                          `${value}${sensor.unit ? ` ${sensor.unit}` : ""}`,
                          sensor.label,
                        ]}
                        contentStyle={{
                          background: "#142132",
                          border: "1px solid #334455",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={sensor.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
