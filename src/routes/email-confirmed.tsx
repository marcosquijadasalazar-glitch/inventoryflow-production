import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MailCheck, ShieldQuestion } from "lucide-react";
import { WhatsAppHelpButton } from "@/components/onboarding/WhatsAppHelpButton";

export const Route = createFileRoute("/email-confirmed")({
  component: EmailConfirmedPage,
  head: () => ({ meta: [{ title: "Email verified · InventoryFlow" }] }),
});

function EmailConfirmedPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center bg-card border rounded-2xl p-8 shadow-soft">
        <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <MailCheck className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          {t("onboarding.verifiedTitle", { defaultValue: "Email verified successfully." })}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground flex items-center justify-center gap-2">
          <ShieldQuestion className="h-4 w-4" />
          {t("onboarding.verifiedPending", { defaultValue: "Your account is pending approval." })}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("onboarding.verifiedReview", { defaultValue: "An administrator will review your access shortly." })}
        </p>
        <Button asChild className="mt-6 w-full h-11">
          <Link to="/login">{t("onboarding.backToLogin", { defaultValue: "Back to Login" })}</Link>
        </Button>
        <div className="mt-4">
          <WhatsAppHelpButton variant="card" topic="setup" />
        </div>
      </div>
    </div>
  );
}
