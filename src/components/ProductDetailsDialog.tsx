import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Tag, MapPin, Plus, ArrowRightLeft, Minus } from "lucide-react";
import { StockBadge } from "./StockBadge";
import { LabelPrintDialog } from "./LabelPrintDialog";
import { StockActionDialog } from "./StockActionDialog";
import type { Product } from "@/lib/inventory";
import { usePermissions } from "@/lib/use-permissions";
import { listAllNodes, getBreadcrumb } from "@/lib/location-tree";

export function ProductDetailsDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const perms = usePermissions();
  const [labelOpen, setLabelOpen] = useState(false);
  const [action, setAction] = useState<"add" | "remove" | "move" | null>(null);

  const { data: nodes = [] } = useQuery({
    queryKey: ["location-nodes-all"],
    queryFn: listAllNodes,
    enabled: !!product,
  });

  const breadcrumb = useMemo(
    () => (product?.bin_id ? getBreadcrumb(nodes, product.bin_id) : []),
    [nodes, product?.bin_id],
  );

  if (!product) return null;
  const canCost = perms.can("view_costs");
  const canPrice = perms.can("view_prices");
  const canPrint = perms.can("print_labels");
  const canMove = perms.can("create_movements");

  const rows: [string, string | number | null][] = [
    ["SKU", product.sku],
    ["Barcode", product.barcode],
    ["Category", product.category],
    ["Supplier", product.supplier],
    ...(canCost
      ? ([["Cost", `$${Number(product.cost).toFixed(2)}`]] as [string, string][])
      : []),
    ...(canPrice
      ? ([["Price", `$${Number(product.price).toFixed(2)}`]] as [
          string,
          string,
        ][])
      : []),
    ["Stock", product.stock],
    ["Min stock", product.min_stock],
    ...(canCost
      ? ([
          [
            "Inventory value",
            `$${(Number(product.cost) * product.stock).toFixed(2)}`,
          ],
        ] as [string, string][])
      : []),
  ];

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="bg-surface max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {product.name}
              <StockBadge product={product} />
            </DialogTitle>
            <DialogDescription>
              {t("pdd.desc", "Product details")}
            </DialogDescription>
          </DialogHeader>

          {/* Storage hierarchy block */}
          <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {t("pdd.stored_in", "Stored in")}
            </p>
            {breadcrumb.length ? (
              <div className="flex flex-wrap items-center gap-1 text-sm">
                {breadcrumb.map((n, i) => (
                  <span key={n.id} className="flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-muted-foreground">›</span>
                    )}
                    <span
                      className={
                        i === breadcrumb.length - 1
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {n.code ? `${n.code} · ` : ""}
                      {n.name}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {product.location ||
                  t("pdd.unassigned", "Unassigned inventory")}
              </p>
            )}
          </div>

          {canMove && (
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAction("add")}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t("pdd.add_stock", "Add stock")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAction("move")}
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                {t("pdd.move", "Move")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAction("remove")}
              >
                <Minus className="h-4 w-4 mr-1" />
                {t("pdd.remove", "Remove")}
              </Button>
            </div>
          )}

          <dl className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {rows.map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between px-3 py-2 text-sm odd:bg-surface-muted/40"
              >
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium text-right">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {canPrint && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setLabelOpen(true)}
                disabled={!product.barcode && !product.sku}
              >
                <Tag className="h-4 w-4 mr-1.5" />
                {t("scanner.printLabel")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <LabelPrintDialog
        product={labelOpen ? product : null}
        onClose={() => setLabelOpen(false)}
      />
      <StockActionDialog
        product={action ? product : null}
        mode={action}
        contextLocationId={(product as any)?.bin_id ?? null}
        contextLocationLabel={
          breadcrumb.length
            ? breadcrumb.map((n) => n.code || n.name).join(" / ")
            : undefined
        }
        onClose={() => setAction(null)}
      />
    </>
  );
}
