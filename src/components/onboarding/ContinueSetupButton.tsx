import { useTranslation } from "react-i18next";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingState, useChecklistProgress } from "@/lib/use-onboarding";
import { resumeWizard, useWizardSnoozed } from "./wizard-snooze";

/**
 * Persistent CTA that lets owners/managers safely resume the onboarding wizard
 * from their last saved step after closing it (intentionally or accidentally).
 */
export function ContinueSetupButton({
  variant = "default",
  className,
}: {
  variant?: "default" | "compact" | "banner";
  className?: string;
}) {
  const { t } = useTranslation();
  const state = useOnboardingState();
  const snoozed = useWizardSnoozed();
  const progress = useChecklistProgress(state.data?.hasOrg === true);

  if (!state.data?.hasOrg) return null;
  if (state.data.org?.onboarding_completed) return null;
  if (state.data.role !== "owner" && state.data.role !== "super_admin") return null;
  if (!snoozed) return null; // Wizard is already showing — no need for CTA.

  const pct = progress.data?.percent ?? 0;
  const handleResume = () => resumeWizard();

  if (variant === "compact") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleResume}
        className={`h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10 ${className ?? ""}`}
      >
        <Rocket className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("onboarding.continue.short", "Continue setup")}</span>
        <span className="sm:hidden">{t("onboarding.continue.shortMobile", "Setup")}</span>
        {pct > 0 && <span className="text-[10px] opacity-70">· {pct}%</span>}
      </Button>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={`rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex items-center gap-3 ${className ?? ""}`}
      >
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Rocket className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {t("onboarding.continue.bannerTitle", "Pick up where you left off")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              "onboarding.continue.bannerBody",
              "Your setup is saved. Finish a few quick steps to get the most out of InventoryFlow.",
            )}
          </p>
        </div>
        <Button onClick={handleResume} size="sm">
          {t("onboarding.continue.cta", "Continue setup")}
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleResume} variant="outline" className={className}>
      <Rocket className="h-4 w-4" /> {t("onboarding.continue.cta", "Continue setup")}
    </Button>
  );
}
