import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Boxes, AlertCircle, Mail, Lock, Sparkles, Activity, Shield } from "lucide-react";
import { toast } from "sonner";

type Mode = "signin" | "signup";

export function AuthCard({ initialMode = "signin" }: { initialMode?: Mode }) {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && session && !signupSuccess) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [authLoading, session, navigate, signupSuccess]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/email-confirmed` },
        });
        if (err) throw err;
        setSignupSuccess(true);
        toast.success("Account created. Check your email to verify your account.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        toast.success("Welcome back");
      }
    } catch (e: any) {
      setError(e?.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) {
        setError((result.error as any)?.message ?? "Google sign-in failed");
      }
    } catch (e: any) {
      setError(e?.message ?? "Google sign-in failed");
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-gradient-to-br from-[oklch(0.22_0.06_265)] via-[oklch(0.18_0.05_260)] to-[oklch(0.14_0.04_260)] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[oklch(0.55_0.18_305)]/20 blur-3xl" />
        </div>
        <Link to="/" className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">InventoryFlow</span>
            <span className="text-[11px] uppercase tracking-wider text-white/50">Warehouse OS</span>
          </div>
        </Link>
        <div className="relative space-y-8 max-w-md">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">
              Modern warehouse operations
            </p>
            <h2 className="text-4xl font-semibold tracking-tight leading-tight">
              Inventory that runs itself.
            </h2>
            <p className="mt-4 text-white/70 leading-relaxed">
              Real-time stock, intelligent alerts, and clean movement history — built for teams that ship.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              { icon: Activity, label: "Live inventory health", desc: "See risk before it's a problem" },
              { icon: Sparkles, label: "Frictionless movements", desc: "Add, remove, adjust in seconds" },
              { icon: Shield, label: "Secure by default", desc: "Encrypted sessions, per-user access" },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-xs text-white/60">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-white/40">
          © {new Date().getFullYear()} InventoryFlow. All rights reserved.
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden mb-8 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] flex items-center justify-center shadow-soft">
              <Boxes className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">InventoryFlow</span>
          </Link>

          <div className="space-y-1.5 mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to manage your inventory."
                : "Start tracking your warehouse in minutes."}
            </p>
          </div>

          {signupSuccess && (
            <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <p className="font-medium text-foreground">Account created.</p>
              <p className="mt-1 text-muted-foreground">
                Check your email to verify your account. After verification, your account will be reviewed by an administrator.
              </p>
              <Link to="/login" className="mt-3 inline-block text-primary font-medium hover:underline">
                Back to Login
              </Link>
            </div>
          )}

          <Button type="button" variant="outline" className="w-full h-11 shadow-soft" onClick={google} disabled={googleBusy || busy}>
            <GoogleIcon />
            {googleBusy ? "Redirecting…" : "Continue with Google"}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-background px-3 text-muted-foreground">or with email</span>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-11" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 h-11" minLength={6} required />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full h-11 shadow-soft" disabled={busy || googleBusy}>
              {busy ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                  {mode === "signin" ? "Signing in…" : "Creating account…"}
                </>
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New to InventoryFlow?{" "}
                <Link to="/signup" onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link to="/login" onClick={() => setMode("signin")} className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>

          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            By continuing you agree to our{" "}
            <Link to="/" className="underline hover:text-foreground">terms</Link>{" "}
            and{" "}
            <Link to="/" className="underline hover:text-foreground">privacy policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.88 0 3.14.8 3.86 1.48l2.64-2.54C16.8 3.3 14.62 2.3 12 2.3c-5.46 0-9.9 4.44-9.9 9.9s4.44 9.9 9.9 9.9c5.72 0 9.5-4.02 9.5-9.68 0-.65-.07-1.15-.16-1.62H12z" />
      <path fill="#4285F4" d="M21.34 12.42c0-.65-.07-1.15-.16-1.62H12v3.9h5.5c-.11.66-.7 1.66-2 2.36l3.2 2.48c1.86-1.72 2.94-4.26 2.94-7.12z" />
      <path fill="#FBBC05" d="M5.5 14.2a6.07 6.07 0 0 1 0-4.4l-3.32-2.56A9.9 9.9 0 0 0 2.1 12.2c0 1.62.38 3.14 1.08 4.56l3.32-2.56z" />
      <path fill="#34A853" d="M12 22.1c2.62 0 4.82-.86 6.42-2.34l-3.2-2.48c-.86.6-2.02 1.02-3.22 1.02-2.48 0-4.58-1.66-5.34-3.9L3.34 16.96A9.9 9.9 0 0 0 12 22.1z" />
    </svg>
  );
}
