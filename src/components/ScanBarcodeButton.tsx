import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ScanBarcodeButton({
  variant = "outline",
  size = "sm",
}: {
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default";
}) {
  const { t } = useTranslation();
  return (
    <Button asChild variant={variant} size={size}>
      <Link to="/scanner">
        <ScanLine className="h-4 w-4 mr-1.5" />
        {t("common.scanBarcode")}
      </Link>
    </Button>
  );
}
