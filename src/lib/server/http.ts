import "server-only";
import { NextResponse } from "next/server";
import { publicSupabase } from "@/lib/supabase/public";
import { publicSupabaseConfig } from "@/lib/supabase/config";
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function publicClient() {
  if (!publicSupabaseConfig())
    return { error: json({ error: "Supabase is not configured." }, 503) };
  return { client: publicSupabase() };
}
export { sameOrigin } from "@/lib/request-security";
export async function readBody(
  request: Request,
  maxBytes = 32768,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("Expected application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Payload too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
