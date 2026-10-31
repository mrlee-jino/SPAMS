"use server";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { publicSupabaseConfig } from "@/lib/supabase/config";
export async function signIn(form: FormData) {
  if (!publicSupabaseConfig()) redirect("/login?error=config");
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 254 || !password || password.length > 1024)
    redirect("/login?error=credentials");
  const client = await serverSupabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  redirect("/live");
}
export async function signOut() {
  const client = await serverSupabase();
  await client.auth.signOut();
  redirect("/login");
}
