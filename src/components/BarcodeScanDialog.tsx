import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BarcodeScanInput } from "@/components/BarcodeScanInput";
import { useTranslation } from "react-i18next";
import { ScanLine } from "lucide-react";

export function BarcodeScanDialog({
  open,
  onOpenChange,
  onScan,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScan: (code: string) => void;
  title?: string;
  description?: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            {title ?? t("common.scanBarcode")}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <BarcodeScanInput
          onScan={(code) => {
            onScan(code);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
