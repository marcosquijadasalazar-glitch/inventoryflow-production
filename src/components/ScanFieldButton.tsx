import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { BarcodeScanDialog } from "./BarcodeScanDialog";
import { useTranslation } from "react-i18next";

export function ScanFieldButton({
  onScan,
  title,
  description,
  className,
}: {
  onScan: (code: string) => void;
  title?: string;
  description?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className={className}
        aria-label={t("common.scanBarcode")}
        title={t("common.scanBarcode")}
      >
        <ScanLine className="h-4 w-4" />
      </Button>
      <BarcodeScanDialog
        open={open}
        onOpenChange={setOpen}
        onScan={onScan}
        title={title}
        description={description}
      />
    </>
  );
}
