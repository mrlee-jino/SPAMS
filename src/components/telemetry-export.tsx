"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { csvCell } from "@/lib/pagination";
import type { Observation } from "@/lib/dashboard";
export function TelemetryExport({ gatewayId }: { gatewayId: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const until = end ? new Date(end) : new Date();
      const since = start
        ? new Date(start)
        : new Date(until.getTime() - 86400000);
      const params = new URLSearchParams({
        gateway: gatewayId,
        start: since.toISOString(),
        end: until.toISOString(),
      });
      let snapshot: string | undefined,
        after: string | null = null;
      const rows: Observation[] = [];
      do {
        if (snapshot) params.set("snapshot", snapshot);
        if (after) params.set("after", after);
        const r = await fetch("/api/telemetry/export?" + params, {
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Export failed");
        rows.push(...data.rows);
        if (rows.length > 100000)
          throw new Error(
            "Export exceeds 100,000 observations. Narrow the date range; no incomplete file was downloaded.",
          );
        snapshot = data.snapshot;
        const next = data.next as string | null;
        if (next && next === after)
          throw new Error("Export pagination did not advance");
        after = next;
      } while (after);
      const fields = [
        "id",
        "node_id",
        "sampled_at",
        "received_at",
        "temperature_c",
        "water_level_m",
        "battery_percent",
        "sensor_health",
        "source",
      ] as const;
      const csv = [
        fields.join(","),
        ...rows.map((row) => fields.map((f) => csvCell(row[f])).join(",")),
      ].join("\r\n");
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `spams-telemetry-${since.toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        `Exported ${rows.length} observations with source labels. Cutoff: ${snapshot}.`,
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Export failed; no incomplete file was downloaded.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="export-controls">
      <label>
        From (local time)
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        To (local time)
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <button disabled={busy} onClick={download}>
        <Download size={14} />
        {busy ? "Collecting all pages…" : "Export telemetry CSV"}
      </button>
      <p role="status">
        {message ||
          "Default: last 24 hours. Up to 31 days per export; no dashboard row cap."}
      </p>
    </div>
  );
}
