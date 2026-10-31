import { forecastTemperature } from "./forecast";

export type NodeStatus = "online" | "stale" | "offline";
export interface MonitoringNode {
  id: string;
  name: string;
  position: string;
  temperature: number | null;
  level: number | null;
  status: NodeStatus;
  heartbeat: string;
  battery: number;
  sensorHealth: "healthy" | "check required" | "unavailable";
  acoustic: boolean;
}
export const nodes: MonitoringNode[] = [
  {
    id: "01",
    name: "Node 01",
    position: "North inlet",
    temperature: 28.4,
    level: 1.24,
    status: "online",
    heartbeat: "12 seconds ago",
    battery: 86,
    sensorHealth: "healthy",
    acoustic: true,
  },
  {
    id: "02",
    name: "Node 02",
    position: "Northeast bank",
    temperature: 28.6,
    level: 1.22,
    status: "online",
    heartbeat: "18 seconds ago",
    battery: 79,
    sensorHealth: "healthy",
    acoustic: true,
  },
  {
    id: "03",
    name: "Node 03",
    position: "East center",
    temperature: 28.3,
    level: 1.25,
    status: "online",
    heartbeat: "9 seconds ago",
    battery: 91,
    sensorHealth: "healthy",
    acoustic: true,
  },
  {
    id: "04",
    name: "Node 04",
    position: "South outlet",
    temperature: 28.7,
    level: 1.21,
    status: "online",
    heartbeat: "24 seconds ago",
    battery: 72,
    sensorHealth: "healthy",
    acoustic: false,
  },
  {
    id: "05",
    name: "Node 05",
    position: "Southwest bank",
    temperature: 28.5,
    level: 1.23,
    status: "stale",
    heartbeat: "4 minutes ago",
    battery: 34,
    sensorHealth: "check required",
    acoustic: false,
  },
  {
    id: "06",
    name: "Node 06",
    position: "West center",
    temperature: null,
    level: null,
    status: "offline",
    heartbeat: "28 minutes ago",
    battery: 18,
    sensorHealth: "unavailable",
    acoustic: false,
  },
];
export const history = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  temperature: Number(
    (27.8 + Math.sin((i - 6) / 5) * 0.65 + i * 0.012).toFixed(2),
  ),
  level: Number((1.24 + Math.sin(i / 4) * 0.025).toFixed(3)),
}));
export function linearForecast() {
  return forecastTemperature(history.slice(-6));
}
export const navigation = [
  ["dashboard", "Overview"],
  ["nodes", "Monitoring nodes"],
  ["analytics", "Analytics"],
  ["predictions", "Predictions"],
  ["hydroacoustics", "Hydroacoustics"],
  ["pump-control", "Pump control"],
  ["power-monitoring", "Power monitoring"],
  ["alerts", "Alerts"],
  ["settings", "Settings"],
] as const;
