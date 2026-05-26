import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreditCard, ExternalLink, Loader2, Sparkles, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getBillingStatus,
  createCheckoutSession,
  createPortalSession,
} from "@/lib/billing.functions";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    trialing: { label: "Trial", variant: "secondary" },
    past_due: { label: "Past due", variant: "destructive" },
    unpaid: { label: "Unpaid", variant: "destructive" },
    canceled: { label: "Cancelled", variant: "outline" },
    incomplete: { label: "Incomplete", variant: "outline" },
    incomplete_expired: { label: "Expired", variant: "outline" },
  };
  const v = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function BillingPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getBillingStatus);
  const checkout = useServerFn(createCheckoutSession);
  const portal = useServerFn(createPortalSession);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => fetchStatus({}),
    staleTime: 15_000,
  });

  // Toast on return from Stripe
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("billing");
    if (result === "success") {
      toast.success("Subscription updated. It may take a few seconds to reflect.");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["billing-status"] }), 2000);
      params.delete("billing");
      const q = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
    } else if (result === "cancelled") {
      toast.info("Checkout cancelled.");
      params.delete("billing");
      const q = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
    }
  }, [qc]);

  const goCheckout = async (plan: "starter" | "pro") => {
    setBusy(plan);
    try {
      const { url } = await checkout({ data: { plan } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start checkout");
      setBusy(null);
    }
  };

  const goPortal = async () => {
    setBusy("portal");
    try {
      const { url } = await portal({});
      window.location.href = url;
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (/no billing account|customer not configured|No organization|Stripe customer/i.test(msg)) {
        toast.error("No billing account found.");
      } else {
        toast.error(msg || "Failed to open billing portal");
      }
      setBusy(null);
    }
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Billing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  if (!data.is_owner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Billing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only the organization owner can manage billing. Current plan: <strong className="capitalize">{data.plan}</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isPastDue = data.subscription_status === "past_due" || data.subscription_status === "unpaid";
  const isTrialing = data.subscription_status === "trialing";
  const planLabel = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Billing & Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPastDue && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>
              Update your payment method to keep your subscription active.
              {data.grace_period_ends_at && (
                <> Grace period ends <strong>{fmtDate(data.grace_period_ends_at)}</strong>.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isTrialing && data.current_period_end && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Free trial active</AlertTitle>
            <AlertDescription>
              Your trial ends on <strong>{fmtDate(data.current_period_end)}</strong>.
            </AlertDescription>
          </Alert>
        )}

        {data.cancel_at_period_end && data.current_period_end && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Cancellation scheduled</AlertTitle>
            <AlertDescription>
              Your subscription ends on <strong>{fmtDate(data.current_period_end)}</strong>. Reactivate from the billing portal.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Current plan</div>
            <div className="font-medium mt-1 flex items-center gap-2">
              {planLabel} {statusBadge(data.subscription_status)}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">
              {isTrialing ? "Trial ends" : "Renews on"}
            </div>
            <div className="font-medium mt-1">{fmtDate(data.current_period_end)}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Setup fee</div>
            <div className="font-medium mt-1 flex items-center gap-1.5">
              {data.setup_fee_paid ? (
                <>
                  Paid
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </>
              ) : (
                <>One-time on first paid plan</>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PlanCard
            name="Starter"
            price="$14.99/mo"
            setupNote={data.setup_fee_paid ? "Setup fee already paid" : "+ $49 one-time setup fee"}
            features={["3 users", "500 products", "2 locations", "Purchase & sales orders"]}
            current={data.plan === "starter"}
            onSelect={() => goCheckout("starter")}
            busy={busy === "starter"}
            ctaLabel={data.plan === "free" ? "Subscribe" : data.plan === "pro" ? "Downgrade" : "Current"}
          />
          <PlanCard
            name="Pro"
            price="$79/mo"
            setupNote={data.setup_fee_paid ? "Setup fee already paid" : "+ $99 one-time setup fee"}
            features={["25 users", "Unlimited products", "10 locations", "All modules + reports"]}
            current={data.plan === "pro"}
            onSelect={() => goCheckout("pro")}
            busy={busy === "pro"}
            ctaLabel={data.plan === "pro" ? "Current" : "Upgrade"}
            highlight
          />
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">{t("billing.guaranteeTitle")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("billing.guaranteeDesc")}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Need Enterprise? <a href="mailto:sales@inventoryflowapp.com" className="underline">Contact sales</a>.
          </p>
          <Button variant="outline" size="sm" onClick={goPortal} disabled={busy === "portal"}>
            {busy === "portal" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
            Billing Portal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCard({
  name, price, setupNote, features, current, onSelect, busy, ctaLabel, highlight,
}: {
  name: string;
  price: string;
  setupNote?: string;
  features: string[];
  current: boolean;
  onSelect: () => void;
  busy: boolean;
  ctaLabel: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 flex flex-col ${highlight ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">{name}</h3>
        <span className="text-sm text-muted-foreground">{price}</span>
      </div>
      {setupNote && (
        <div className="mt-1 text-xs text-muted-foreground">{setupNote}</div>
      )}
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-4 w-full"
        variant={current ? "outline" : highlight ? "default" : "secondary"}
        disabled={current || busy}
        onClick={onSelect}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
        {current ? "Current plan" : ctaLabel}
      </Button>
    </div>
  );
}
