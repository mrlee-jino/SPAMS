"use client";
import Link from "next/link";
import { Wifi, Activity, ChevronRight, ArrowRight } from "lucide-react";
import { Panel } from "./ui";
export function AlertsPanel() {
  return (
    <Panel
      title="Needs attention"
      subtitle="2 sample events"
      action={
        <Link href="/alerts" className="text-link">
          View all <ArrowRight size={13} />
        </Link>
      }
    >
      <Link href="/nodes/06" className="alert-row">
        <span className="alert-icon amber">
          <Wifi size={17} />
        </span>
        <div>
          <h3>Node 06 is offline</h3>
          <p>No heartbeat for 28 minutes</p>
        </div>
        <ChevronRight size={16} />
      </Link>
      <Link href="/nodes/05" className="alert-row">
        <span className="alert-icon blue">
          <Activity size={17} />
        </span>
        <div>
          <h3>Node 05 data is stale</h3>
          <p>Check sensor & communication link</p>
        </div>
        <ChevronRight size={16} />
      </Link>
    </Panel>
  );
}
