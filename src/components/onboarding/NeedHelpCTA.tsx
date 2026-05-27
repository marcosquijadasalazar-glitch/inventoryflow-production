import { useTranslation } from "react-i18next";
import { Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL, BOOK_DEMO_URL } from "@/lib/contact";

export function NeedHelpCTA({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center gap-2 text-sm"
          : "rounded-lg border border-border bg-surface p-4 space-y-3"
      }
    >
      {!compact && (
        <div>
          <p className="font-medium">{t("onboarding.help.title")}</p>
          <p className="text-sm text-muted-foreground">{t("onboarding.help.subtitle")}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <Mail className="h-4 w-4" />
            {t("onboarding.help.contactSupport", "Contact Support")}
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={BOOK_DEMO_URL} target="_blank" rel="noopener noreferrer">
            <Calendar className="h-4 w-4" />
            {t("onboarding.help.bookDemo")}
          </a>
        </Button>
      </div>
    </div>
  );
}

