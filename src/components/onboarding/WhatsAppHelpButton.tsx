import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappUrl, WHATSAPP_ONBOARDING_MESSAGE } from "@/lib/contact";

type Variant = "button" | "card" | "inline";
type Topic = "setup" | "import" | "scanner" | "general";

const MESSAGES: Record<Topic, string> = {
  setup: `Hola 👋 / Hi 👋\n\nNecesito ayuda configurando mi cuenta de InventoryFlow.\nI need help setting up my InventoryFlow account.`,
  import: `Hola 👋 / Hi 👋\n\nNecesito ayuda importando mis productos a InventoryFlow.\nI need help importing my products into InventoryFlow.`,
  scanner: `Hola 👋 / Hi 👋\n\nNecesito ayuda configurando el escaneo de códigos de barras.\nI need help configuring barcode scanning.`,
  general: WHATSAPP_ONBOARDING_MESSAGE,
};

export function WhatsAppHelpButton({
  variant = "button",
  topic = "general",
  label,
  className,
}: {
  variant?: Variant;
  topic?: Topic;
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const href = whatsappUrl(MESSAGES[topic]);
  const text =
    label ??
    t(`onboarding.whatsapp.topics.${topic}`, {
      defaultValue: t("onboarding.whatsapp.chat", "Chat with us on WhatsApp"),
    });

  if (variant === "card") {
    return (
      <div
        className={`rounded-lg border border-[oklch(0.65_0.18_150)]/25 bg-[oklch(0.65_0.18_150)]/5 p-4 flex items-start gap-3 ${className ?? ""}`}
      >
        <div className="h-9 w-9 rounded-lg bg-[oklch(0.65_0.18_150)]/15 text-[oklch(0.45_0.18_150)] flex items-center justify-center shrink-0">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {t(`onboarding.whatsapp.titles.${topic}`, {
              defaultValue: t("onboarding.whatsapp.needHelp", "Need a hand?"),
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("onboarding.whatsapp.subtitle", "Message our team on WhatsApp — we usually reply in minutes.")}
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="border-[oklch(0.65_0.18_150)]/40 text-[oklch(0.45_0.18_150)] hover:bg-[oklch(0.65_0.18_150)]/10"
        >
          <a href={href} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> {t("onboarding.whatsapp.chat", "WhatsApp")}
          </a>
        </Button>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-xs text-muted-foreground hover:text-[oklch(0.45_0.18_150)] inline-flex items-center gap-1 ${className ?? ""}`}
      >
        <MessageCircle className="h-3.5 w-3.5" /> {text}
      </a>
    );
  }

  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={`border-[oklch(0.65_0.18_150)]/40 text-[oklch(0.45_0.18_150)] hover:bg-[oklch(0.65_0.18_150)]/10 ${className ?? ""}`}
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4" /> {text}
      </a>
    </Button>
  );
}
