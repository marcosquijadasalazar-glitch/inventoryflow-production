import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { WhatsAppHelpButton } from "@/components/onboarding/WhatsAppHelpButton";

export const Route = createFileRoute("/pending-approval")({
  validateSearch: (s: Record<string, unknown>) => ({
    reason: typeof s.reason === "string" ? s.reason : undefined,
    scope: typeof s.scope === "string" ? s.scope : undefined,
  }),
  component: PendingApprovalPage,
  head: () => ({ meta: [{ title: "Pending approval · InventoryFlow" }] }),
});

function PendingApprovalPage() {
  const { t } = useTranslation();
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { reason, scope } = Route.useSearch();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  const titleKey =
    reason === "trial_expired"
      ? "pending.trialExpiredTitle"
      : reason === "suspended"
      ? "pending.suspendedTitle"
      : reason === "rejected"
      ? "pending.rejectedTitle"
      : reason === "cancelled"
      ? "pending.cancelledTitle"
      : "pending.title";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center bg-card border rounded-2xl p-8 shadow-soft">
        <div className="mx-auto h-14 w-14 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
          <Clock className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          {t(titleKey, { defaultValue: "Your account is pending approval." })}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("pending.body", {
            defaultValue: "An administrator will review your access shortly. You'll receive an email once your account is activated.",
          })}
        </p>
        {reason && (
          <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
            {t("access.statusLabel")}: <span className="font-mono">{reason}</span>
            {scope ? ` (${scope})` : null}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild variant="outline" className="w-full h-11">
            <Link to="/login">{t("onboarding.backToLogin", { defaultValue: "Back to Login" })}</Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full h-11"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
          >
            <LogOut className="h-4 w-4" /> {t("nav.signOut")}
          </Button>
        </div>
        <div className="mt-4">
          <WhatsAppHelpButton variant="card" topic="setup" />
        </div>
      </div>
    </div>
  );
}
