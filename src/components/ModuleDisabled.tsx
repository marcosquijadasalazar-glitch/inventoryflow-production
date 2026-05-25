import { Lock, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useUpgradeModal } from "@/components/UpgradeDialog";

export function ModuleDisabled({ label }: { label?: string }) {
  const { t } = useTranslation();
  const { open } = useUpgradeModal();
  return (
    <div className="flex items-center justify-center py-24 px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          {label ?? t("modules.unavailable", "Module unavailable")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "modules.upgradeBody",
            "This module is not enabled for your company. Upgrade your plan or contact your administrator to enable it.",
          )}
        </p>
        <Button onClick={() => open({ reason: "feature", featureLabel: label })}>
          <Sparkles className="h-4 w-4 mr-1.5" />
          {t("plan.upgradeCta", "Upgrade plan")}
        </Button>
      </div>
    </div>
  );
}
