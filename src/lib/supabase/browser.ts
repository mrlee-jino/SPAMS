"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseConfig } from "./config";
export function browserSupabase() {
  const config = publicSupabaseConfig();
  if (!config) throw new Error("Supabase configuration is incomplete.");
  return createBrowserClient(config.url, config.key);
}
