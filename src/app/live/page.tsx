import { redirect } from "next/navigation";
import { publicSupabaseConfig } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { LiveWorkspace } from "@/components/live-workspace";
export const dynamic = "force-dynamic";
export default async function LivePage() {
  if (!publicSupabaseConfig()) redirect("/login?error=config");
  const client = await serverSupabase();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  return <LiveWorkspace email={user.email ?? "Administrator"} />;
}
