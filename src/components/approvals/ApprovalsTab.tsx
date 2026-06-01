import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Lock, BarChart3, ClipboardList, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  listApprovalPolicies,
  upsertApprovalPolicy,
  listApprovalRequests,
  decideApprovalRequest,
  approvalAnalytics,
} from "@/lib/approvals.functions";
import { getTransferPackage } from "@/lib/transfers.functions";
import {
  APPROVAL_ACTIONS,
  APPROVAL_ACTION_LABELS,
  DEFAULT_POLICIES,
  type ApprovalAction,
  type ApprovalPolicy,
} from "@/lib/approvals";

export function ApprovalsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Approval Policies
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Require supervisor approval for high-risk inventory actions. Operators are not blocked from
          working — they get an in-session approval modal.
        </p>
      </div>

      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Policies</TabsTrigger>
          <TabsTrigger value="queue" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Pending Approvals</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="policies" className="mt-4"><PoliciesCard /></TabsContent>
        <TabsContent value="queue" className="mt-4"><QueueCard /></TabsContent>
        <TabsContent value="analytics" className="mt-4"><AnalyticsCard /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Policies ---------- */
function PoliciesCard() {
  const fetch = useServerFn(listApprovalPolicies);
  const save = useServerFn(upsertApprovalPolicy);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["approval-policies"], queryFn: () => fetch() });
  const [draft, setDraft] = useState<Record<ApprovalAction, ApprovalPolicy>>(() => ({ ...DEFAULT_POLICIES }));

  useEffect(() => {
    if (!data?.policies) return;
    const next = { ...DEFAULT_POLICIES };
    for (const p of data.policies as ApprovalPolicy[]) next[p.action_type] = { ...next[p.action_type], ...p };
    setDraft(next);
  }, [data]);

  if (isLoading) return <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading…</CardContent></Card>;
  const canConfigure = !!data?.canConfigure;

  const update = async (action: ApprovalAction, patch: Partial<ApprovalPolicy>) => {
    const next = { ...draft[action], ...patch };
    setDraft((d) => ({ ...d, [action]: next }));
    try {
      await save({ data: {
        action_type: action,
        enabled: next.enabled,
        threshold_qty: next.threshold_qty,
        threshold_value: next.threshold_value,
        required_role: next.required_role,
        block_completely: next.block_completely,
      } });
      qc.invalidateQueries({ queryKey: ["approval-policies"] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      {!canConfigure && (
        <Card><CardContent className="py-3 text-sm flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" /> Read-only. Only owners and managers can change approval policies.
        </CardContent></Card>
      )}
      {APPROVAL_ACTIONS.map((action) => {
        const p = draft[action];
        const disabled = !canConfigure;
        return (
          <Card key={action}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{APPROVAL_ACTION_LABELS[action]}</CardTitle>
                  <CardDescription>
                    {p.block_completely
                      ? "Blocked — users cannot perform this action."
                      : p.enabled
                        ? `Requires ${p.required_role} approval when thresholds are exceeded.`
                        : "No approval required."}
                  </CardDescription>
                </div>
                <Switch checked={p.enabled} disabled={disabled} onCheckedChange={(v) => update(action, { enabled: v })} />
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity threshold</Label>
                <Input type="number" min={0} value={p.threshold_qty ?? ""} disabled={disabled || !p.enabled}
                  onChange={(e) => update(action, { threshold_qty: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Value threshold ($)</Label>
                <Input type="number" min={0} step="0.01" value={p.threshold_value ?? ""} disabled={disabled || !p.enabled}
                  onChange={(e) => update(action, { threshold_value: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Approver role</Label>
                <Select value={p.required_role} disabled={disabled || !p.enabled}
                  onValueChange={(v) => update(action, { required_role: v as "manager" | "owner" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">Block completely</Label>
                <div className="h-9 flex items-center">
                  <Switch checked={p.block_completely} disabled={disabled}
                    onCheckedChange={(v) => update(action, { block_completely: v })} />
                  <span className="ml-2 text-xs text-muted-foreground">No approval — action blocked.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Queue ---------- */
function QueueCard() {
  const fetch = useServerFn(listApprovalRequests);
  const decide = useServerFn(decideApprovalRequest);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "expired" | "all">("pending");
  const { data, isLoading } = useQuery({
    queryKey: ["approval-requests", status],
    queryFn: () => fetch({ data: { status, limit: 50 } }),
  });
  const [noteByReq, setNoteByReq] = useState<Record<string, string>>({});

  const act = async (id: string, decision: "approved" | "rejected") => {
    try {
      await decide({ data: { request_id: id, decision, decision_note: noteByReq[id] } });
      toast.success(`Request ${decision}`);
      qc.invalidateQueries({ queryKey: ["approval-requests"] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Approval Queue</CardTitle>
            <CardDescription>Review and decide pending approval requests from your team.</CardDescription>
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["pending", "approved", "rejected", "expired", "all"].map((s) => (
                <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (data?.requests?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No requests.</p>
        )}
        {(data?.requests as any[] | undefined)?.map((r) => (
          <div key={r.id} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">
                  {APPROVAL_ACTION_LABELS[r.action_type as ApprovalAction] ?? r.action_type}
                  {r.entity_label && <span className="text-muted-foreground"> — {r.entity_label}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  Requested by {r.requested_by_email ?? "—"} · {new Date(r.created_at).toLocaleString()}
                </div>
                <div className="text-xs mt-1"><span className="font-medium">Reason:</span> {r.reason}</div>
                {r.decision_note && (
                  <div className="text-xs"><span className="font-medium">Decision note:</span> {r.decision_note}</div>
                )}
              </div>
              <Badge variant="outline">{r.status}</Badge>
            </div>
            {r.action_type === "transfer_order" && r.payload?.transfer_id && (
              <TransferPackagePreview transferId={r.payload.transfer_id} />
            )}
            {r.status === "pending" && data?.canDecide && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs">Decision note (optional)</Label>
                  <Input value={noteByReq[r.id] ?? ""} onChange={(e) => setNoteByReq((m) => ({ ...m, [r.id]: e.target.value }))} />
                </div>
                <Button size="sm" variant="outline" onClick={() => act(r.id, "rejected")}>Reject</Button>
                <Button size="sm" onClick={() => act(r.id, "approved")}>Approve</Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TransferPackagePreview({ transferId }: { transferId: string }) {
  const fetch = useServerFn(getTransferPackage);
  const { data, isLoading } = useQuery({
    queryKey: ["transfer-package", transferId],
    queryFn: () => fetch({ data: { transfer_id: transferId } }),
  });
  if (isLoading) return <div className="text-xs text-muted-foreground border-t border-border pt-2">Loading transfer details…</div>;
  const t = (data as any)?.transfer;
  const items = ((data as any)?.items ?? []) as any[];
  const snapshot = ((data as any)?.items_snapshot ?? []) as any[];
  if (!t) return <div className="text-xs text-muted-foreground border-t border-border pt-2">Transfer no longer available.</div>;
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
  const snapById = new Map(snapshot.map((s) => [s.product_id, s]));
  return (
    <div className="border-t border-border pt-2 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div><div className="text-muted-foreground">Transfer #</div><div className="font-medium">{t.transfer_number}</div></div>
        <div><div className="text-muted-foreground">Source</div><div className="font-medium">{t.from_location}</div></div>
        <div><div className="text-muted-foreground">Destination</div><div className="font-medium">{t.to_location}</div></div>
        <div><div className="text-muted-foreground">Status</div><div className="font-medium">{t.status}</div></div>
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-2 py-1">Product</th>
              <th className="text-left px-2 py-1">SKU</th>
              <th className="text-right px-2 py-1">Qty</th>
              <th className="text-right px-2 py-1">On hand @ source</th>
              <th className="text-right px-2 py-1">Reserved @ source</th>
              <th className="text-right px-2 py-1">Available @ source</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const s = i.product_id ? snapById.get(i.product_id) : null;
              return (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-2 py-1">{i.product_name ?? "—"}</td>
                  <td className="px-2 py-1 text-muted-foreground">{i.sku ?? "—"}</td>
                  <td className="px-2 py-1 text-right">{i.quantity}</td>
                  <td className="px-2 py-1 text-right">{s ? s.on_hand : "—"}</td>
                  <td className="px-2 py-1 text-right">{s ? s.reserved_at_source : "—"}</td>
                  <td className="px-2 py-1 text-right">{s ? s.available_at_source : "—"}</td>
                </tr>
              );
            })}
            <tr className="border-t border-border bg-muted/20">
              <td className="px-2 py-1 font-medium" colSpan={2}>Total</td>
              <td className="px-2 py-1 text-right font-medium">{totalQty}</td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      </div>
      {t.notes && <div className="text-xs"><span className="font-medium">Notes:</span> {t.notes}</div>}
    </div>
  );
}

/* ---------- Analytics ---------- */
function AnalyticsCard() {
  const fetch = useServerFn(approvalAnalytics);
  const { data, isLoading } = useQuery({ queryKey: ["approval-analytics"], queryFn: () => fetch() });
  if (isLoading) return <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading…</CardContent></Card>;
  const t = data?.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          ["Total", t?.total ?? 0],
          ["Approved", t?.approved ?? 0],
          ["Rejected", t?.rejected ?? 0],
          ["Pending", t?.pending ?? 0],
          ["Expired", t?.expired ?? 0],
        ].map(([k, v]) => (
          <Card key={k as string}><CardContent className="py-4">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="text-2xl font-semibold">{v as number}</div>
          </CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Most approved actions</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(data?.mostApproved ?? []).length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
            {(data?.mostApproved ?? []).map(([k, v]: any) => (
              <div key={k} className="flex justify-between text-sm"><span>{APPROVAL_ACTION_LABELS[k as ApprovalAction] ?? k}</span><span className="font-medium">{v}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Most rejected actions</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(data?.mostRejected ?? []).length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
            {(data?.mostRejected ?? []).map(([k, v]: any) => (
              <div key={k} className="flex justify-between text-sm"><span>{APPROVAL_ACTION_LABELS[k as ApprovalAction] ?? k}</span><span className="font-medium">{v}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> High-risk activity (last 90 days)</CardTitle></CardHeader>
        <CardContent>
          {(data?.highRisk ?? []).length === 0 && <p className="text-sm text-muted-foreground">No high-risk approvals recorded.</p>}
          <ul className="space-y-1 text-sm">
            {(data?.highRisk as any[] | undefined)?.map((r, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{APPROVAL_ACTION_LABELS[r.action_type as ApprovalAction] ?? r.action_type} — {r.entity_label ?? r.requested_by_email}</span>
                <Badge variant="outline">{r.status}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
