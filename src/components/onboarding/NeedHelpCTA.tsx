import { useTranslation } from "react-i18next";
import { MessageCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappUrl, WHATSAPP_ONBOARDING_MESSAGE, BOOK_DEMO_URL } from "@/lib/contact";

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
        <Button
          asChild
          size="sm"
          className="bg-[oklch(0.65_0.18_150)] hover:bg-[oklch(0.6_0.18_150)] text-white"
        >
          <a href={whatsappUrl(WHATSAPP_ONBOARDING_MESSAGE)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" />
            {t("onboarding.help.whatsapp")}
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
