import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";
/** Anonymous client: RLS is the boundary even inside server routes. */
export function publicSupabase() {
  const config = publicSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  return createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
