"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";
let client: SupabaseClient | undefined;
export function browserSupabase() {
  if (client) return client;
  const config = publicSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  client = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}
