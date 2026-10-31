import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";
/** Only device routes and the authorized research worker use this client. Public dashboards use anonymous RLS. */
export function deviceSupabase() {
  const config = publicSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) throw new Error("Device ingestion is not configured.");
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
