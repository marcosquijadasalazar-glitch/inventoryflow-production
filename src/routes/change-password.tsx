import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Lock, KeyRound } from "lucide-react";
import { clearMustChangePassword } from "@/lib/org-users.functions";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
  head: () => ({ meta: [{ title: "Change password · InventoryFlow" }] }),
});

function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clearFlag = useServerFn(clearMustChangePassword);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
      if (!data.session) navigate({ to: "/login", replace: true });
    });
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("changePassword.tooShort", { defaultValue: "Password must be at least 8 characters." }));
      return;
    }
    if (password !== confirm) {
      setError(t("changePassword.mismatch", { defaultValue: "Passwords do not match." }));
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      await clearFlag({});
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setSuccess(true);
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1200);
    } catch (e: any) {
      setError(e?.message ?? "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  if (checking || !hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="h-3.5 w-3.5 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 shadow-soft">
        <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-center">
          {t("changePassword.title", { defaultValue: "Set your password" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          {t("changePassword.subtitle", {
            defaultValue:
              "You're using a temporary password. Please choose a new one to continue.",
          })}
        </p>

        {success ? (
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-center">
            <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="font-medium text-foreground">
              {t("changePassword.success", { defaultValue: "Password updated. Redirecting…" })}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">
                {t("changePassword.newPassword", { defaultValue: "New password" })}
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
                  minLength={8}
                  required
                  disabled={busy}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">
                {t("changePassword.confirmPassword", { defaultValue: "Confirm new password" })}
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
                  minLength={8}
                  required
                  disabled={busy}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full h-11 shadow-soft" disabled={busy}>
              {busy
                ? t("changePassword.updating", { defaultValue: "Updating…" })
                : t("changePassword.update", { defaultValue: "Update password" })}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                onClick={async (e) => {
                  e.preventDefault();
                  await supabase.auth.signOut();
                  navigate({ to: "/login", replace: true });
                }}
                className="font-medium text-primary hover:underline"
              >
                {t("changePassword.signOut", { defaultValue: "Sign out" })}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
