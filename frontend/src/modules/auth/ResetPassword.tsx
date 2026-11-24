import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { AuthCard } from "./AuthCard";

export default function ResetPassword() {
  const nav = useNavigate();
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY") setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (resendAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const sendResetEmail = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset-password` });
      if (error) {
        setError(error.message);
        return;
      }
      setEmailSent(true);
      setResendAt(Date.now() + 60_000);
      setNow(Date.now());
      setMsg("If that email has an account, a reset link is on its way.");
    } catch {
      setError("We couldn't send the reset email. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const secondsUntilResend = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  if (recovery) {
    return (
      <AuthCard title="Choose a new password">
        <form className="flex flex-col gap-4" onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.auth.updateUser({ password });
          if (error) setError(error.message); else nav("/");
        }}>
          <Field label="New password" hint="At least 8 characters."><Input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit">Save password</Button>
        </form>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Reset your password" sub="We'll email you a link.">
      <form className="flex flex-col gap-4" noValidate onSubmit={async (e) => {
        e.preventDefault();
        const emailInput = e.currentTarget.elements.namedItem("email");
        if (emailInput instanceof HTMLInputElement && !emailInput.validity.valid) {
          setEmailError(emailInput.validity.valueMissing ? "Enter your email address." : "Enter a valid email address.");
          return;
        }
        setEmailError(null);
        await sendResetEmail();
      }}>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required disabled={emailSent} value={email}
            aria-invalid={!!emailError} aria-describedby={emailError ? "reset-email-error" : undefined}
            onChange={(e) => { setEmail(e.target.value); setEmailError(null); }} />
        </Field>
        {emailError && <p id="reset-email-error" className="text-xs font-semibold text-unread" role="alert">{emailError}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
        {msg && <p className="text-sm text-growth">{msg}</p>}
        {!emailSent ? <Button type="submit" busy={busy}>Send reset link</Button> : (
          <Button type="button" kind="secondary" busy={busy} disabled={secondsUntilResend > 0} onClick={() => void sendResetEmail()}>
            {secondsUntilResend > 0 ? `Resend reset email in ${secondsUntilResend}s` : "Resend reset email"}
          </Button>
        )}
      </form>
    </AuthCard>
  );
}
