"use client";
import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { linearForecast } from "@/lib/simulation";
import { Badge, Panel } from "./ui";
export function Forecast({ expanded = false }: { expanded?: boolean }) {
  const f = linearForecast();
  return (
    <Panel
      title="Temperature outlook"
      subtitle="Linear Regression · 1 hour ahead"
      action={
        <span className="icon-box">
          <ArrowUpRight size={18} />
        </span>
      }
    >
      <div className="forecast-number">
        {f.value.toFixed(1)}
        <span>°C</span>
        <Badge tone="blue">Forecast</Badge>
      </div>
      <p className="forecast-caption">Predicted pond-wide mean temperature</p>
      <div className="forecast-plot">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={[
              ...f.points.map((p) => ({
                time: p.time,
                actual: p.temperature,
                forecast: p.fit,
              })),
              { time: "+1h", forecast: f.value },
            ]}
          >
            <XAxis dataKey="time" hide />
            <YAxis domain={["dataMin - .2", "dataMax + .2"]} hide />
            <Tooltip
              contentStyle={{
                background: "#142132",
                border: "1px solid #334455",
                borderRadius: 10,
              }}
            />
            <Line
              dataKey="actual"
              stroke="#31d5bc"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="forecast"
              stroke="#79a8ff"
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="forecast-meta">
        <span>Training window</span>
        <strong>Last 6 hourly samples</strong>
      </div>
      <p className="disclaimer">
        Illustrative model on simulated means. No validated accuracy or
        confidence interval.
      </p>
      {expanded ? (
        <div className="info-box">
          Ordinary least squares fits temperature against elapsed hours. Slope:{" "}
          {f.slope.toFixed(3)} °C/hour. Production forecasts need validated
          aggregation, missing-data rules, holdout evaluation, and model
          provenance.
        </div>
      ) : (
        <Link className="text-link" href="/predictions">
          Explore predictions <ArrowRight size={14} />
        </Link>
      )}
    </Panel>
  );
}
