"use client";
import Link from "next/link";
import { Radio, Cpu } from "lucide-react";
import { nodes } from "@/lib/simulation";
import { Badge, Panel } from "./ui";
export function PondMap() {
  return (
    <Panel
      title="Pond network"
      subtitle="Six stationary nodes · conceptual placement"
      action={<Badge>Gateway connected · demo</Badge>}
    >
      <div className="pond-map">
        <div className="pond-grid" />
        <div className="pond-shape">
          <span className="pond-label">
            POND A<span>RESEARCH SITE</span>
          </span>
          {nodes.map((n, i) => (
            <Link
              href={`/nodes/${n.id}`}
              key={n.id}
              className={`map-node map-node-${i} ${n.status}`}
              aria-label={`${n.name}, ${n.status}`}
            >
              <Radio size={16} />
              <span>N{n.id}</span>
            </Link>
          ))}
        </div>
        <div className="gateway-marker">
          <Cpu size={17} />
          <span>GW-01</span>
        </div>
        <span className="map-north">N ↑</span>
        <div className="map-key">
          <span>
            <i />
            Online
          </span>
          <span>
            <i className="amber-bg" />
            Stale
          </span>
          <span>
            <i className="gray-bg" />
            Offline
          </span>
        </div>
      </div>
    </Panel>
  );
}
