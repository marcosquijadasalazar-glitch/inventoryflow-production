import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { createNode, LEVEL_LABEL, type NodeLevel } from "@/lib/location-tree";

export function LocationNodeDialog({
  open,
  level,
  parentId,
  parentLabel,
  onClose,
}: {
  open: boolean;
  level: NodeLevel;
  parentId: string | null;
  parentLabel?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("warehouse");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setType(level === "sublocation" ? "shelf" : "warehouse");
      setAddress("");
      setNotes("");
    }
  }, [open, level]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createNode({
        name,
        node_level: level,
        parent_id: parentId,
        type: level === "bin" ? "bin" : type,
        address: level === "location" ? address || null : null,
        notes: notes || null,
        code: level === "aisle" || level === "bin" ? code || null : null,
      });
      toast.success(
        t("ln.created", { defaultValue: "{{label}} created", label: t(`ln.levels.${level}`, LEVEL_LABEL[level]) }),
      );
      qc.invalidateQueries({ queryKey: ["location-nodes-all"] });
      qc.invalidateQueries({ queryKey: ["locations"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  const title =
    level === "location"
      ? t("ln.new_location", "New Location")
      : level === "sublocation"
        ? t("ln.new_sublocation", "New Sub-location")
        : level === "aisle"
          ? t("ln.new_aisle", "New Aisle")
          : t("ln.new_bin", "New Bin");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {parentLabel && (
            <p className="text-xs text-muted-foreground">
              {t("ln.parent", "Parent")}: <span className="font-medium">{parentLabel}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <Label>{t("ln.name", "Name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              placeholder={
                level === "bin"
                  ? "Shelf-3"
                  : level === "aisle"
                    ? "Aisle A"
                    : level === "sublocation"
                      ? "Cold Storage"
                      : "Main Warehouse"
              }
            />
          </div>

          {(level === "aisle" || level === "bin") && (
            <div className="space-y-1.5">
              <Label>{t("ln.code", "Code")}</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={level === "bin" ? "A-01" : "A"}
              />
            </div>
          )}

          {level === "location" && (
            <>
              <div className="space-y-1.5">
                <Label>{t("ln.type", "Type")}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">{t("loc.types.warehouse", "Warehouse")}</SelectItem>
                    <SelectItem value="store">{t("loc.types.store", "Store")}</SelectItem>
                    <SelectItem value="truck">{t("loc.types.truck", "Truck")}</SelectItem>
                    <SelectItem value="other">{t("loc.types.other", "Other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("ln.address", "Address (optional)")}</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </>
          )}

          {level === "sublocation" && (
            <div className="space-y-1.5">
              <Label>{t("ln.type", "Type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shelf">Area / Shelf</SelectItem>
                  <SelectItem value="warehouse">Freezer</SelectItem>
                  <SelectItem value="store">Front Store</SelectItem>
                  <SelectItem value="other">Kitchen / Storage Room</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("ln.notes", "Notes (optional)")}</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving", "Saving…") : t("common.create", "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
