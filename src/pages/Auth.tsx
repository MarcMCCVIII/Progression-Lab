import { useState, type FormEvent } from "react";
import {
  login,
  signup,
  requestPasswordRecovery,
  updateUser,
  AuthError,
} from "@netlify/identity";
import { GraduationCap, LockKeyhole, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup" | "forgot" | "reset";
export function AuthPage({
  recovery,
  initialError,
  onComplete,
}: {
  recovery: boolean;
  initialError: string;
  onComplete: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>(recovery ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setConfirmation("");
    setError("");
    setMessage("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if ((mode === "signup" || mode === "reset") && password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        await onComplete();
      }
      if (mode === "signup") {
        const user = await signup(email.trim(), password, {
          full_name: name.trim(),
        });
        if (user.confirmedAt) await onComplete();
        else {
          switchMode("login");
          setMessage(
            "Check your email to confirm your account, then sign in. Check your spam folder if needed.",
          );
        }
      }
      if (mode === "forgot") {
        await requestPasswordRecovery(email.trim());
        setMessage(
          "If an account exists for this email, a password reset link is on its way.",
        );
      }
      if (mode === "reset") {
        await updateUser({ password });
        await onComplete();
      }
    } catch (cause) {
      setError(
        cause instanceof AuthError
          ? cause.status === 401
            ? "Unable to sign in. Check your email, password, and email confirmation."
            : cause.message
          : "Unable to reach the account service. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: "Welcome back.",
    signup: "Make room for progress.",
    forgot: "Reset your password.",
    reset: "Choose a new password.",
  }[mode];
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-sidebar px-7 py-9 text-sidebar-foreground sm:px-12 lg:p-16">
        <div className="flex items-center gap-3">
          <GraduationCap className="size-9 text-sidebar-ring" />
          <span className="font-display text-xl font-semibold">
            Progression Lab
          </span>
        </div>
        <div className="relative my-12 max-w-lg lg:my-24">
          <p className="mb-5 text-xs uppercase tracking-[0.22em] text-sidebar-ring">
            Your teaching. Your workspace.
          </p>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            Every student has
            <br />a story of progress.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-sidebar-foreground/65">
            Keep your classes, assessments, and student growth together in a
            private account you can access wherever you teach.
          </p>
          <div
            className="mt-10 flex h-24 items-end gap-3 border-b border-sidebar-border"
            aria-hidden="true"
          >
            {[30, 44, 37, 58, 52, 72, 88].map((height, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-sidebar-ring/60"
                style={{ height: `${height}%`, opacity: 0.35 + i * 0.1 }}
              />
            ))}
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
          <LockKeyhole className="size-4" />
          Your records are private to your account.
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm animate-fade-rise">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Assessment analytics
          </p>
          <h2 className="font-display text-3xl font-semibold">{title}</h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">
            {mode === "signup"
              ? "Create a free account with your email. Start with your own private, empty workspace."
              : mode === "login"
                ? "Sign in to your private workspace."
                : "Use your account email to get back to your workspace."}
          </p>
          <form onSubmit={submit} className="space-y-5">
            <fieldset disabled={busy} className="space-y-5">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={120}
                  />
                </div>
              )}
              {mode !== "reset" && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              )}
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {mode === "reset" ? "New password" : "Password"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "login" ? 1 : 8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {mode !== "login" && (
                    <p className="text-xs text-muted-foreground">
                      Use at least 8 characters.
                    </p>
                  )}
                </div>
              )}
              {(mode === "signup" || mode === "reset") && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    required
                  />
                </div>
              )}
            </fieldset>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm"
              >
                {message}
              </p>
            )}
            <Button className="w-full gap-2" disabled={busy}>
              {busy
                ? "Please wait…"
                : {
                    login: "Sign in",
                    signup: "Create account",
                    forgot: "Send reset link",
                    reset: "Save password",
                  }[mode]}
              <ArrowRight className="size-4" />
            </Button>
          </form>
          {mode !== "reset" && (
            <div className="mt-6 space-y-4 text-center text-sm">
              {mode === "login" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => switchMode("forgot")}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </button>
              )}
              <p className="text-muted-foreground">
                {mode === "login"
                  ? "New to Progression Lab? "
                  : "Already have an account? "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    switchMode(mode === "login" ? "signup" : "login")
                  }
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
