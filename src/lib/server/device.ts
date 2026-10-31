import "server-only";
import { createHash } from "node:crypto";
import { deviceSupabase } from "@/lib/supabase/admin";
import { json } from "./http";
export async function authenticateDevice(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return { error: json({ error: "Device authentication required." }, 401) };
  const token = authorization.slice(7);
  if (token.length < 32 || token.length > 256)
    return { error: json({ error: "Invalid device credentials." }, 401) };
  let client;
  try {
    client = deviceSupabase();
  } catch {
    return { error: json({ error: "Device ingestion is unavailable." }, 503) };
  }
  const { data, error } = await client
    .from("device_credentials")
    .select("gateway_id")
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .is("revoked_at", null)
    .maybeSingle();
  if (error)
    return {
      error: json({ error: "Device authentication service unavailable." }, 503),
    };
  if (!data)
    return { error: json({ error: "Invalid device credentials." }, 401) };
  const gateway = await client
    .from("gateways")
    .select("data_source")
    .eq("id", data.gateway_id)
    .single();
  if (gateway.error)
    return { error: json({ error: "Gateway unavailable." }, 503) };
  if (
    request.headers.get("x-spams-simulator") === "true" &&
    gateway.data.data_source !== "simulation"
  )
    return {
      error: json({ error: "Simulator must use a simulation gateway." }, 403),
    };
  return {
    client,
    gatewayId: data.gateway_id as string,
    source: gateway.data.data_source as "hardware" | "simulation",
  };
}
