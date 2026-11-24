import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { AuthCard, GoogleButton, OrLine } from "./AuthCard";

export function signInErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message ?? "")) {
    return "Email or password is incorrect. Check both fields and try again, or reset your password.";
  }
  return "We couldn't sign you in. Check your connection and try again.";
}

// Password sign-in only. Emailed sign-in links were removed: every email counts against Supabase's hourly email limit.
export default function SignIn() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (session) return <Navigate to={next} replace />;

  const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(signInErrorMessage(error)); else nav(next);
    } catch (error) {
      setError(signInErrorMessage(error instanceof Error ? { message: error.message } : {}));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Sign in" sub="Pick up where you left off.">
      <GoogleButton onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect } })} />
      <OrLine />
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" busy={busy}>Sign in</Button>
      </form>
      <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
        <Link className="text-primary hover:opacity-60" to={`/auth/sign-up?next=${encodeURIComponent(next)}`}>Create an account</Link>
        <Link className="text-primary hover:opacity-60" to="/auth/reset-password">Forgot password?</Link>
      </div>
    </AuthCard>
  );
}
