import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Flame } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export type PurgeConfirmTexts = {
  title: string;
  description: string;
  targetLabel?: string | null;
};

/**
 * Hard-purge confirmation dialog.
 * Always requires:
 *  - current account password
 *  - typing "PURGE" exactly
 * Additionally, when `requireForceConfirmation` is true, requires typing
 * the `forcePhrase` (default "PURGE COMPANY DATA") to acknowledge data loss.
 */
export function PurgeConfirmDialog({
  open,
  onOpenChange,
  texts,
  requireForceConfirmation = false,
  forcePhrase = "PURGE COMPANY DATA",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  texts: PurgeConfirmTexts;
  requireForceConfirmation?: boolean;
  forcePhrase?: string;
  onConfirm: (input: {
    password: string;
    reason: string | null;
    forceConfirmation: string | null;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [force, setForce] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirm("");
      setForce("");
      setReason("");
      setPending(false);
    }
  }, [open]);

  const canSubmit =
    confirm === "PURGE" &&
    password.length > 0 &&
    (!requireForceConfirmation || force === forcePhrase) &&
    !pending;

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    try {
      await onConfirm({
        password,
        reason: reason.trim() || null,
        forceConfirmation: requireForceConfirmation ? force : null,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? t("purge.failed", "Purge failed"));
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Flame className="h-5 w-5" /> {texts.title}
          </DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>

        {texts.targetLabel && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
            <span className="font-mono">{texts.targetLabel}</span>
          </div>
        )}

        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {t(
              "purge.irreversibleWarning",
              "This permanently removes the record and related data. This action cannot be undone.",
            )}
          </span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="purge-pwd">
              {t("purge.password", "Current account password")}
            </Label>
            <Input
              id="purge-pwd"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purge-confirm">
              {t("purge.typeToConfirm", "Type")}{" "}
              <span className="font-mono font-semibold">PURGE</span>{" "}
              {t("purge.toConfirm", "to confirm")}
            </Label>
            <Input
              id="purge-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="PURGE"
            />
          </div>
          {requireForceConfirmation && (
            <div className="space-y-1.5">
              <Label htmlFor="purge-force" className="text-destructive">
                {t(
                  "purge.forceAck",
                  "This company has inventory or orders. Type",
                )}{" "}
                <span className="font-mono font-semibold">{forcePhrase}</span>{" "}
                {t("purge.toForce", "to force purge")}
              </Label>
              <Input
                id="purge-force"
                value={force}
                onChange={(e) => setForce(e.target.value)}
                placeholder={forcePhrase}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="purge-reason">
              {t("purge.reason", "Reason (optional)")}
            </Label>
            <Textarea
              id="purge-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!canSubmit}>
            {pending
              ? t("purge.purging", "Purging…")
              : t("purge.purgePermanently", "Purge permanently")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
