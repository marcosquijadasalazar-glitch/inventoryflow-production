import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMovement, type Product } from "@/lib/inventory";
import { Plus, Minus, Scale, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listAllNodes, getBreadcrumb, type LocationNode } from "@/lib/location-tree";
import { useQuery } from "@tanstack/react-query";

const sb = supabase as any;

type Mode = "add" | "remove" | "adjust" | "move";

function formatPath(nodes: LocationNode[], id: string | null): string {
  if (!id) return "—";
  return getBreadcrumb(nodes, id)
    .map((n) => n.code || n.name)
    .join(" / ");
}

export function StockActionDialog({
  product,
  mode,
  contextLocationLabel,
  onClose,
}: {
  product: Product | null;
  mode: Mode | null;
  contextLocationLabel?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [qty, setQty] = useState(
    mode === "adjust" && product ? String(product.stock) : "1",
  );
  const [reason, setReason] = useState<string>("damaged");
  const [adjustReason, setAdjustReason] = useState<string>("physical_count");
  const [note, setNote] = useState("");
  const [toNodeId, setToNodeId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const nodesQ = useQuery({
    queryKey: ["location-nodes-all"],
    queryFn: listAllNodes,
    enabled: mode === "move",
  });

  if (!product || !mode) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(qty, 10);
    if (isNaN(q) || q < 0)
      return toast.error(t("sa.invalid_qty", "Enter a valid quantity"));
    if (mode !== "adjust" && q <= 0)
      return toast.error(t("sa.invalid_qty", "Enter a valid quantity"));
    setSaving(true);
    try {
      if (mode === "add") {
        await createMovement({
          product_id: product.id,
          type: "add",
          quantity: q,
          note: note || null,
        });
        toast.success(t("sa.added", "Stock added"));
      } else if (mode === "remove") {
        if (q > product.stock)
          throw new Error(t("sa.insufficient", "Insufficient stock"));
        await createMovement({
          product_id: product.id,
          type: "remove",
          quantity: q,
          note: `[${reason}] ${note || ""}`.trim(),
        });
        toast.success(t("sa.removed", "Stock removed"));
      } else if (mode === "adjust") {
        if (q === product.stock) {
          toast.info(t("sa.no_change", "Quantity unchanged"));
          setSaving(false);
          return;
        }
        await createMovement({
          product_id: product.id,
          type: "adjustment",
          quantity: q,
          note: `[${adjustReason}] ${note || ""}`.trim(),
        });
        toast.success(
          t("sa.adjusted_to", "Stock set to {{qty}}", { qty: q }),
        );
      } else if (mode === "move") {
        if (!toNodeId)
          throw new Error(t("sa.select_dest", "Select a destination"));
        if (q > product.stock)
          throw new Error(t("sa.insufficient", "Insufficient stock"));
        // Create a completed transfer order — picked up by per-location math.
        const { data: to, error: tErr } = await sb
          .from("transfer_orders")
          .insert({
            transfer_number: `TR-${Date.now()}`,
            to_location_id: toNodeId,
            from_location_id: null,
            status: "completed",
            transfer_date: new Date().toISOString().slice(0, 10),
            completed_date: new Date().toISOString().slice(0, 10),
            notes: note || null,
          })
          .select()
          .single();
        if (tErr) throw tErr;
        const { error: iErr } = await sb.from("transfer_order_items").insert({
          transfer_order_id: to.id,
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          barcode: product.barcode ?? null,
          quantity: q,
        });
        if (iErr) throw iErr;
        toast.success(t("sa.moved", "Product moved"));
      }
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["location_stock"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === "add"
      ? t("sa.add_title", "Add stock")
      : mode === "remove"
        ? t("sa.remove_title", "Remove stock")
        : mode === "adjust"
          ? t("sa.adjust_title", "Adjust quantity")
          : t("sa.move_title", "Move product");

  const Icon =
    mode === "add"
      ? Plus
      : mode === "remove"
        ? Minus
        : mode === "adjust"
          ? Scale
          : ArrowRightLeft;

  const adjustDiff =
    mode === "adjust" ? parseInt(qty, 10) - product.stock : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" /> {title}
          </DialogTitle>
          <DialogDescription>
            {product.name}{" "}
            <span className="font-mono text-xs">({product.sku})</span>
            <span className="ml-2 text-xs">
              · {t("sa.current", "Current")}: {product.stock}
            </span>
            {contextLocationLabel && (
              <span className="block text-xs mt-0.5">
                {t("sa.at", "At")}: {contextLocationLabel}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              {mode === "adjust"
                ? t("sa.new_qty", "New quantity")
                : t("sa.quantity", "Quantity")}
            </Label>
            <Input
              type="number"
              min={mode === "adjust" ? 0 : 1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
            {mode === "adjust" && !isNaN(adjustDiff) && (
              <p className="text-xs text-muted-foreground">
                {t("sa.diff", "Difference")}:{" "}
                <span
                  className={
                    adjustDiff > 0
                      ? "text-[oklch(0.4_0.12_155)]"
                      : adjustDiff < 0
                        ? "text-destructive"
                        : ""
                  }
                >
                  {adjustDiff > 0 ? "+" : ""}
                  {adjustDiff}
                </span>
              </p>
            )}
          </div>

          {mode === "remove" && (
            <div className="space-y-1.5">
              <Label>{t("sa.reason", "Reason")}</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damaged">
                    {t("sa.reasons.damaged", "Damaged")}
                  </SelectItem>
                  <SelectItem value="expired">
                    {t("sa.reasons.expired", "Expired")}
                  </SelectItem>
                  <SelectItem value="internal_use">
                    {t("sa.reasons.internal_use", "Internal use")}
                  </SelectItem>
                  <SelectItem value="lost">
                    {t("sa.reasons.lost", "Lost")}
                  </SelectItem>
                  <SelectItem value="other">
                    {t("sa.reasons.other", "Other")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "move" && (
            <div className="space-y-1.5">
              <Label>{t("sa.destination", "Destination")}</Label>
              <Select value={toNodeId} onValueChange={setToNodeId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("sa.pick_dest", "Pick a location / bin")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(nodesQ.data ?? []).map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {formatPath(nodesQ.data ?? [], n.id)}
                      <span className="text-muted-foreground text-xs ml-2">
                        · {n.node_level}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("sa.notes", "Notes (optional)")}</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("sa.notes_ph", "Reason or reference")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving", "Saving…") : title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
