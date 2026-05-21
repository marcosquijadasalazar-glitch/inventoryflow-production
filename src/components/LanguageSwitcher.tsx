import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLanguage } from "@/i18n";
import { Languages } from "lucide-react";

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const value = (i18n.resolvedLanguage ?? "en").startsWith("es") ? "es" : "en";
  return (
    <Select value={value} onValueChange={(v) => setLanguage(v as "en" | "es")}>
      <SelectTrigger
        className={compact ? "h-8 px-2 text-xs gap-1.5" : "h-9 gap-2"}
      >
        <Languages className="h-3.5 w-3.5 opacity-60" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="es">Español</SelectItem>
      </SelectContent>
    </Select>
  );
}
