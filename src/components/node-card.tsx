"use client";
import Link from "next/link";
import { Radio, Thermometer, Droplets, Clock3, Activity } from "lucide-react";
import type { MonitoringNode } from "@/lib/simulation";
import { Badge } from "./ui";
export function NodeCard({ node }: { node: MonitoringNode }) {
  return (
    <Link
      className={`node-card ${node.status === "offline" ? "muted-card" : ""}`}
      href={`/nodes/${node.id}`}
    >
      <div className="node-top">
        <span className="node-icon">
          <Radio size={18} />
        </span>
        <div>
          <h3>{node.name}</h3>
          <p>{node.position}</p>
        </div>
        <Badge
          tone={
            node.status === "online"
              ? "teal"
              : node.status === "stale"
                ? "amber"
                : "gray"
          }
        >
          {node.status}
        </Badge>
      </div>
      <div className="node-readings">
        <div>
          <span>
            <Thermometer size={13} /> Temperature
          </span>
          <strong>
            {node.temperature?.toFixed(1) ?? "—"}
            <small> °C</small>
          </strong>
        </div>
        <div>
          <span>
            <Droplets size={13} /> Water level
          </span>
          <strong>
            {node.level?.toFixed(2) ?? "—"}
            <small> m</small>
          </strong>
        </div>
      </div>
      <div className="node-footer">
        <span>
          <Clock3 size={12} />
          {node.heartbeat}
        </span>
        <span
          className={node.sensorHealth === "healthy" ? "teal" : "amber"}
          title={`Sensor health: ${node.sensorHealth}`}
        >
          <Activity size={13} />
          {node.sensorHealth === "healthy"
            ? "Healthy"
            : node.sensorHealth === "unavailable"
              ? "No signal"
              : "Check sensor"}
        </span>
      </div>
      {node.status === "stale" && (
        <p className="stale-note">
          Last known values · excluded from current mean
        </p>
      )}
    </Link>
  );
}
