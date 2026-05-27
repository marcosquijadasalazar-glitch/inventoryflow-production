import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/inventory";

type Symbology = "code128" | "ean13" | "upca" | "ean8";

function detectSymbology(barcode: string): Symbology {
  const digits = /^\d+$/.test(barcode);
  if (digits && barcode.length === 13) return "ean13";
  if (digits && barcode.length === 12) return "upca";
  if (digits && barcode.length === 8) return "ean8";
  return "code128";
}

export function LabelPrintDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copies, setCopies] = useState("1");
  const [includePrice, setIncludePrice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const code = (product?.barcode || product?.sku || "").trim();
  const symbology = code ? detectSymbology(code) : "code128";

  // Render the barcode preview
  useEffect(() => {
    if (!product || !canvasRef.current || !code) return;
    setRenderError(null);
    let cancelled = false;
    (async () => {
      try {
        const bwip = await import("bwip-js");
        if (cancelled || !canvasRef.current) return;
        bwip.toCanvas(canvasRef.current, {
          bcid: symbology,
          text: code,
          scale: 3,
          height: 14,
          includetext: true,
          textxalign: "center",
          textsize: 9,
        });
      } catch (e: any) {
        // Most often: invalid EAN/UPC checksum → fall back to code128
        try {
          const bwip = await import("bwip-js");
          if (cancelled || !canvasRef.current) return;
          bwip.toCanvas(canvasRef.current, {
            bcid: "code128",
            text: code,
            scale: 3,
            height: 14,
            includetext: true,
            textxalign: "center",
            textsize: 9,
          });
        } catch (e2: any) {
          if (!cancelled) setRenderError(e2?.message ?? "Render failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product, code, symbology]);

  if (!product) return null;

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const n = Math.max(1, Math.min(50, parseInt(copies, 10) || 1));
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) {
      toast.error(t("scanner.labels.popupBlocked"));
      return;
    }
    const labels = Array.from({ length: n })
      .map(
        () => `
        <div class="label">
          <div class="name">${escapeHtml(product.name)}</div>
          <img src="${dataUrl}" />
          <div class="meta">SKU ${escapeHtml(product.sku)}</div>
          ${
            includePrice && product.price != null
              ? `<div class="price">$${Number(product.price).toFixed(2)}</div>`
              : ""
          }
        </div>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><title>${escapeHtml(
      product.name,
    )}</title>
      <style>
        @page { margin: 8mm; }
        body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 8px; }
        .label { display: inline-block; width: 220px; padding: 8px; margin: 4px; border: 1px dashed #ccc; text-align: center; page-break-inside: avoid; }
        .name { font-weight: 600; font-size: 12px; margin-bottom: 4px; }
        .meta { font-size: 10px; color: #555; margin-top: 4px; }
        .price { font-size: 14px; font-weight: 700; margin-top: 2px; }
        img { width: 100%; height: auto; }
      </style></head><body>${labels}<script>window.onload=function(){setTimeout(function(){window.print();},150);}<\/script></body></html>`);
    w.document.close();
  };

  const handleDownloadPdf = async () => {
    if (!canvasRef.current) return;
    setBusy(true);
    try {
      const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const n = Math.max(1, Math.min(50, parseInt(copies, 10) || 1));
      const doc = new jsPDF({ unit: "mm", format: [60, 40] });
      for (let i = 0; i < n; i++) {
        if (i > 0) doc.addPage([60, 40], "portrait");
        doc.setFontSize(8);
        doc.text(product.name.slice(0, 32), 30, 5, { align: "center" });
        doc.addImage(dataUrl, "PNG", 5, 8, 50, 18);
        doc.setFontSize(6);
        doc.text(`SKU ${product.sku}`, 30, 30, { align: "center" });
        if (includePrice && product.price != null) {
          doc.setFontSize(10);
          doc.text(`$${Number(product.price).toFixed(2)}`, 30, 36, {
            align: "center",
          });
        }
      }
      doc.save(`label-${product.sku}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "PDF failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle>{t("scanner.labels.title")}</DialogTitle>
          <DialogDescription className="truncate">
            {product.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-4 flex items-center justify-center min-h-[140px]">
            {renderError ? (
              <p className="text-sm text-destructive">{renderError}</p>
            ) : !code ? (
              <p className="text-sm text-muted-foreground">
                {t("scanner.labels.noBarcode")}
              </p>
            ) : (
              <canvas ref={canvasRef} className="max-w-full h-auto" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="label-copies">{t("scanner.labels.copies")}</Label>
              <Input
                id="label-copies"
                type="number"
                min={1}
                max={50}
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includePrice}
                  onCheckedChange={(v) => setIncludePrice(!!v)}
                />
                {t("scanner.labels.includePrice")}
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={busy || !code}
            className="flex-1"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            {t("scanner.labels.downloadPdf")}
          </Button>
          <Button onClick={handlePrint} disabled={!code} className="flex-1">
            <Printer className="h-4 w-4 mr-1.5" />
            {t("scanner.labels.print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
