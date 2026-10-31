import Link from "next/link";
import { publicSupabaseConfig } from "@/lib/supabase/config";
import { LiveWorkspace } from "@/components/live-workspace";
export const dynamic = "force-dynamic";
export default function LivePage() {
  if (!publicSupabaseConfig())
    return (
      <main className="fallback">
        <h1>Pond monitoring</h1>
        <p>
          The public data connection is not configured yet. No readings are
          being substituted.
        </p>
        <Link href="/demo">Explore the labeled simulation</Link>
      </main>
    );
  return <LiveWorkspace />;
}
