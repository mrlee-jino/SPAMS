import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicSupabaseConfig } from "./config";
export async function serverSupabase() {
  const config = publicSupabaseConfig();
  if (!config) throw new Error("Supabase configuration is incomplete.");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (entries) => {
        try {
          entries.forEach(({ name, value, options }) =>
            store.set(name, value, {
              ...options,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            }),
          );
        } catch {
          /* Server Components cannot write cookies; proxy refreshes sessions. */
        }
      },
    },
  });
}
