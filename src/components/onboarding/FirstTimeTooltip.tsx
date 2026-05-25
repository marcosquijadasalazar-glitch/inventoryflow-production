import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Lightweight one-shot tooltip. Stores dismissal in localStorage per key+user.
 * Renders as a small floating card at the top of the page.
 */
export function FirstTimeTooltip({
  storageKey,
  i18nKey,
}: {
  storageKey: string;
  i18nKey: string;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const fullKey = `iflow-tip:${storageKey}`;

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!window.localStorage.getItem(fullKey)) setShow(true);
    } catch {
      /* ignore */
    }
  }, [fullKey]);

  if (!show) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(fullKey, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-3 mb-4">
      <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-medium">{t(`${i18nKey}.title`)}</p>
        <p className="text-muted-foreground mt-0.5">{t(`${i18nKey}.body`)}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={dismiss}
        className="h-7 w-7 p-0 shrink-0"
        aria-label={t("common.close")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
