import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createLocation,
  LOCATION_TYPES,
  type Location,
  type LocationType,
} from "@/lib/locations";

export function LocationFormDialog({
  open,
  onClose,
  onCreated,
  defaultName,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (loc: Location) => void;
  defaultName?: string;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("warehouse");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName ?? "");
      setType("warehouse");
      setAddress("");
      setNotes("");
      setIsActive(true);
    }
  }, [open, defaultName]);

  const submit = async () => {
    if (!name.trim()) return toast.error(t("loc.name_required", "Name is required"));
    setSaving(true);
    try {
      const loc = await createLocation({
        name,
        type,
        address: address || null,
        notes: notes || null,
        is_active: isActive,
      });
      toast.success(t("loc.created", "Location created"));
      onCreated?.(loc);
      onClose();
    } catch (e: any) {
      const { parsePlanLimitError } = await import("@/lib/plan-limits");
      if (parsePlanLimitError(e)) {
        toast.error(`${t("plan.limitReached")} ${t("plan.upgradePrompt")}`);
      } else {
        toast.error(e.message ?? String(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle>{t("loc.create", "Create location")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("loc.name", "Name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Warehouse A"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("loc.type", "Type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as LocationType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((tp) => (
                  <SelectItem key={tp} value={tp}>
                    {t(`loc.types.${tp}`, tp)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>
              {t("loc.address", "Address")}{" "}
              <span className="text-muted-foreground text-xs">
                ({t("common.optional")})
              </span>
            </Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>
              {t("common.notes")}{" "}
              <span className="text-muted-foreground text-xs">
                ({t("common.optional")})
              </span>
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t("loc.active", "Active")}</p>
              <p className="text-xs text-muted-foreground">
                {t("loc.active_hint", "Inactive locations are hidden from pickers")}
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
