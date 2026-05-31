import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { logAuthSecurityEvent } from "@/lib/security.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Lock, KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password · InventoryFlow" }] }),
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const logAuthEvent = logAuthSecurityEvent;

  useEffect(() => {
    // Supabase recovery links arrive with a hash like #access_token=...&type=recovery
    // The client auto-detects and emits PASSWORD_RECOVERY. We also check for errors.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("error=") || hash.includes("error_description=")) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const desc = params.get("error_description") || params.get("error") || "Invalid or expired link";
      setLinkError(decodeURIComponent(desc.replace(/\+/g, " ")));
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Also check if session is already present (hash already processed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // give detectSessionInUrl a moment, then check link validity
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (!d2.session && !hash.includes("type=recovery")) {
              setLinkError(
                t("resetPassword.invalidLink", {
                  defaultValue: "This password reset link is invalid or has expired. Please request a new one.",
                }),
              );
            }
          });
        }, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, [t]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t("resetPassword.tooShort", { defaultValue: "Password must be at least 6 characters." }));
      return;
    }
    if (password !== confirm) {
      setError(t("resetPassword.mismatch", { defaultValue: "Passwords do not match." }));
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      await logAuthEvent({
        data: {
          action: "password_changed",
          status: "success",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        },
      });
      setSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/login", replace: true }), 2000);
    } catch (e: any) {
      setError(e?.message ?? "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 shadow-soft">
        <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-center">
          {t("resetPassword.title", { defaultValue: "Set a new password" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          {t("resetPassword.subtitle", { defaultValue: "Choose a strong password for your account." })}
        </p>

        {success ? (
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-center">
            <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="font-medium text-foreground">
              {t("resetPassword.success", { defaultValue: "Password updated successfully. You can now log in." })}
            </p>
            <Button asChild className="mt-4 w-full h-11">
              <Link to="/login">{t("resetPassword.goLogin", { defaultValue: "Go to login" })}</Link>
            </Button>
          </div>
        ) : linkError ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{linkError}</span>
            </div>
            <Button asChild variant="outline" className="w-full h-11">
              <Link to="/login">{t("resetPassword.backToLogin", { defaultValue: "Back to login" })}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">
                {t("resetPassword.newPassword", { defaultValue: "New password" })}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-11"
                  minLength={6}
                  required
                  disabled={!ready || busy}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">
                {t("resetPassword.confirmPassword", { defaultValue: "Confirm new password" })}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9 h-11"
                  minLength={6}
                  required
                  disabled={!ready || busy}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!ready && !linkError && (
              <p className="text-xs text-muted-foreground text-center">
                {t("resetPassword.verifying", { defaultValue: "Verifying reset link…" })}
              </p>
            )}

            <Button type="submit" className="w-full h-11 shadow-soft" disabled={!ready || busy}>
              {busy
                ? t("resetPassword.updating", { defaultValue: "Updating…" })
                : t("resetPassword.update", { defaultValue: "Update password" })}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t("resetPassword.backToLogin", { defaultValue: "Back to login" })}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
