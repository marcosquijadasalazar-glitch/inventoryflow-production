import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldAlert, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  submitApprovalRequest,
  verifySupervisorAndApprove,
} from "@/lib/approvals.functions";
import {
  APPROVAL_ACTION_LABELS,
  type ApprovalAction,
  type ApprovalPolicy,
} from "@/lib/approvals";

export type ApprovalGateProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ApprovalAction;
  policy: ApprovalPolicy;
  measurements: { quantity?: number; value?: number };
  entityLabel?: string;
  payload?: Record<string, any>;
  reasonHint?: string;
  blocked?: boolean;
  onApproved: () => void | Promise<void>;
};

export function ApprovalGate(props: ApprovalGateProps) {
  const {
    open,
    onOpenChange,
    action,
    policy,
    measurements,
    entityLabel,
    payload,
    reasonHint,
    blocked,
    onApproved,
  } = props;

  const verifyNow = useServerFn(verifySupervisorAndApprove);
  const submitAsync = useServerFn(submitApprovalRequest);
  const qc = useQueryClient();

  const [mode, setMode] = useState<"now" | "later">("now");
  const [supEmail, setSupEmail] = useState("");
  const [supPwd, setSupPwd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const threshold = {
    quantity: measurements.quantity ?? null,
    value: measurements.value ?? null,
    threshold_qty: policy.threshold_qty,
    threshold_value: policy.threshold_value,
  };

  const handleNow = async () => {
    if (!supEmail || !supPwd || reason.trim().length < 3) {
      toast.error("Email, password, and a reason are required.");
      return;
    }
    setBusy(true);
    try {
      await verifyNow({
        data: {
          action_type: action,
          supervisor_email: supEmail,
          supervisor_password: supPwd,
          reason: reason.trim(),
          payload: payload ?? {},
          entity_label: entityLabel,
          threshold_snapshot: threshold,
          required_role: policy.required_role,
        },
      });
      toast.success("Approved by supervisor");
      onOpenChange(false);
      await onApproved();
      qc.invalidateQueries({ queryKey: ["approval-requests"] });
    } catch (e: any) {
      toast.error(e.message || "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLater = async () => {
    if (reason.trim().length < 3) {
      toast.error("A reason is required.");
      return;
    }
    setBusy(true);
    try {
      await submitAsync({
        data: {
          action_type: action,
          reason: reason.trim(),
          payload: payload ?? {},
          entity_label: entityLabel,
          threshold_snapshot: threshold,
          required_role: policy.required_role,
        },
      });
      toast.success("Approval request submitted. You'll be notified once decided.");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["approval-requests"] });
    } catch (e: any) {
      toast.error(e.message || "Could not submit request");
    } finally {
      setBusy(false);
    }
  };

  if (blocked) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-destructive" /> Action blocked
            </DialogTitle>
            <DialogDescription>
              Action blocked by company policy. Contact an owner or manager.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" /> Manager Approval Required
          </DialogTitle>
          <DialogDescription>
            This action exceeds the configured approval threshold for{" "}
            <strong>{APPROVAL_ACTION_LABELS[action]}</strong>.
            {reasonHint && <span className="block mt-1 text-xs">{reasonHint}</span>}
            {entityLabel && <span className="block mt-0.5 text-xs">Item: {entityLabel}</span>}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "now" | "later")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="now">Get approval now</TabsTrigger>
            <TabsTrigger value="later">Request approval</TabsTrigger>
          </TabsList>

          <TabsContent value="now" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this action needed?" />
            </div>
            <div className="space-y-1.5">
              <Label>Supervisor email</Label>
              <Input type="email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Supervisor password</Label>
              <Input type="password" value={supPwd} onChange={(e) => setSupPwd(e.target.value)} autoComplete="new-password" />
            </div>
            <p className="text-xs text-muted-foreground">
              Requires <strong>{policy.required_role}</strong> or owner.
            </p>
          </TabsContent>

          <TabsContent value="later" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this action needed?" />
            </div>
            <p className="text-xs text-muted-foreground">
              A {policy.required_role} or owner will be notified. The action will only run after they approve.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {mode === "now" ? (
            <Button onClick={handleNow} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Approve & continue
            </Button>
          ) : (
            <Button onClick={handleLater} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Submit request
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
