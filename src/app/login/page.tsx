import Link from "next/link";
import { Waves, ShieldCheck } from "lucide-react";
import { publicSupabaseConfig } from "@/lib/supabase/config";
import { signIn } from "./actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = !!publicSupabaseConfig();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Waves size={36} className="teal" />
        <div className="eyebrow">SPAMS-S · ADMINISTRATOR ACCESS</div>
        <h1>Your pond workspace</h1>
        <p>
          Sign in to access authorized pond records. The public preview remains
          simulated.
        </p>
        {(!configured || error === "config") && (
          <div className="info-box" role="status">
            Supabase is not configured yet. Add the project URL and publishable
            key to this deployment.
          </div>
        )}
        {error === "credentials" && (
          <p className="auth-error" role="alert">
            Unable to sign in. Check your credentials and try again.
          </p>
        )}
        <form action={signIn}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
          </label>
          <button className="primary" disabled={!configured}>
            Sign in securely <ShieldCheck size={16} />
          </button>
        </form>
        <p>
          Accounts and pond membership are provisioned by your project
          administrator. Public registration is unavailable.
        </p>
        <Link className="text-link" href="/">
          ← Explore the simulated preview
        </Link>
      </section>
    </main>
  );
}
