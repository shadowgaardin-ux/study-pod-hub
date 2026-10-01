import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, MailCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { GoogleButton } from "@/components/google-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { type Tier } from "@/lib/tiers";
import { supabase } from "@/integrations/supabase/client";

const SKIP_EMAIL_CONFIRMATION = import.meta.env["VITE_SKIP_EMAIL_CONFIRMATION"] === "true";

const authSearchSchema = z.object({
  signup: z.boolean().optional(),
  plan: z.enum(["Free", "Pro", "Max"] as const).optional(),
  // Same-origin relative path to return to after signing in (e.g. the app-authorization screen).
  next: z.string().optional(),
});

function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
}


export const Route = createFileRoute("/auth/")({
  validateSearch: authSearchSchema.parse,
  head: () => ({
    meta: [
      { title: "Log in or sign up — Study Notes" },
      {
        name: "description",
        content: "Access your Study Notes pods, shared lecture notes and flashcard decks.",
      },
      { property: "og:title", content: "Log in or sign up — Study Notes" },
      {
        property: "og:description",
        content: "Access your Study Notes pods, shared lecture notes and flashcard decks.",
      },
    ],
  }),
  component: AuthPage,
});

type View = "auth" | "verify" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { signup, plan, next } = Route.useSearch();
  const nextPath = safeNext(next) ?? (plan && plan !== "Free" ? "/billing" : undefined);
  const { session, loading } = useAuth();
  const [view, setView] = useState<View>("auth");
  const [pendingEmail, setPendingEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const goAfterAuth = useCallback(() => {
    if (nextPath) {
      window.location.href = nextPath;
      return;
    }
    void navigate({ to: "/dashboard", replace: true });
  }, [nextPath, navigate]);

  useEffect(() => {
    if (!loading && session) goAfterAuth();
  }, [loading, session, goAfterAuth]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      toast.error("Could not log in", { description: error.message });
      return;
    }
    toast.success("Welcome back!");
    goAfterAuth();
  }


  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const confirm = String(form.get("confirmPassword"));
    const fullName = String(form.get("fullName"));

    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, tier: plan ?? "Free" },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setBusy(false);
      toast.error("Could not sign up", { description: error.message });
      return;
    }

    // Testing mode: sign the user straight in without email verification.
    if (SKIP_EMAIL_CONFIRMATION) {
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setBusy(false);
          setPendingEmail(email);
          setView("verify");
          return;
        }
      }
      setBusy(false);
      toast.success("Account created", { description: "You're all set — welcome to Study Notes." });
      goAfterAuth();
      return;
    }

    setBusy(false);
    if (data.session) {
      goAfterAuth();
      return;
    }
    setPendingEmail(email);
    setView("verify");
  }

  async function handleForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not send reset email", { description: error.message });
      return;
    }
    toast.success("Reset link sent", { description: `Check ${email} for the reset link.` });
    setView("auth");
  }

  async function resendVerification() {
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      toast.error("Could not resend email", { description: error.message });
      return;
    }
    toast.success("Verification email sent again");
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/40">
      <header className="flex items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back home
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pt-6 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="size-5" />
            </span>
            <h1 className="display mt-4 text-2xl font-semibold">Study Notes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One shared workspace for your course group.
            </p>
          </div>

          {view === "verify" && (
            <div className="surface p-7 text-center">
              <MailCheck className="mx-auto size-9 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium">{pendingEmail}</span>.
                Open it to activate your account — you'll land straight on your dashboard.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Button onClick={resendVerification} disabled={busy} variant="outline">
                  Resend email
                </Button>
                <Button variant="ghost" onClick={() => setView("auth")}>
                  Back to log in
                </Button>
              </div>
            </div>
          )}

          {view === "forgot" && (
            <div className="surface p-7">
              <h2 className="text-lg font-semibold">Reset your password</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll email you a link to choose a new password.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleForgot}>
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" name="email" type="email" required autoComplete="email" />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  Send reset link
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setView("auth")}>
                  Back to log in
                </Button>
              </form>
            </div>
          )}

          {view === "auth" && (
            <div className="surface p-7">
              {plan && (
                <p className="mb-5 rounded-md bg-accent px-3 py-2 text-center text-sm text-accent-foreground">
                  You picked the <span className="font-semibold">{plan}</span> plan — create your
                  account, then pay on the next screen.
                </p>
              )}
              <Tabs defaultValue={signup ? "signup" : "login"}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Log In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <form className="space-y-4" onSubmit={handleLogin}>
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" name="email" type="email" required autoComplete="email" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Password</Label>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setView("forgot")}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? "Logging in…" : "Log in"}
                    </Button>
                  </form>
                  <Divider />
                  <GoogleButton label="Log in with Google" next={nextPath} />
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form className="space-y-4" onSubmit={handleSignup}>
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full name</Label>
                      <Input id="signup-name" name="fullName" required autoComplete="name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input id="signup-email" name="email" type="email" required autoComplete="email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        required
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm">Confirm password</Label>
                      <Input
                        id="signup-confirm"
                        name="confirmPassword"
                        type="password"
                        required
                        autoComplete="new-password"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? "Creating account…" : "Create account"}
                    </Button>
                  </form>
                  <Divider />
                  <GoogleButton label="Sign up with Google" next={nextPath} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
