import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { CreditCard, LogOut, MessageCircle, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getMyAccessStatus } from "@/lib/admin.functions";
import { createCheckoutSession } from "@/lib/billing.functions";
import { whatsappUrl } from "@/lib/contact";


export const Route = createFileRoute("/payment-required")({
  component: PaymentRequiredPage,
  head: () => ({ meta: [{ title: "Payment required · InventoryFlow" }] }),
});

const PLAN_PRICING = {
  starter: { monthly: "$14.99", setup: "$19", label: "Starter", setupLabel: "One-time onboarding" },
  pro: { monthly: "$79", setup: "$79", label: "Pro", setupLabel: "Guided implementation" },
} as const;

function PaymentRequiredPage() {
  const { t } = useTranslation();
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getMyAccessStatus);
  const checkout = useServerFn(createCheckoutSession);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  const access = useQuery({
    queryKey: ["access-status", session?.user?.id],
    queryFn: () => fetchAccess({}),
    enabled: !!session,
    staleTime: 15_000,
  });

  // If user no longer needs this gate (e.g. payment cleared), bounce to dashboard.
  useEffect(() => {
    if (access.data && access.data.ok) {
      navigate({ to: "/dashboard", replace: true });
    } else if (access.data && !access.data.ok && (access.data as any).scope !== "billing") {
      navigate({
        to: "/pending-approval",
        replace: true,
        search: { reason: access.data.reason ?? "pending", scope: (access.data as any).scope ?? "account" } as any,
      });
    }
  }, [access.data, navigate]);

  const pendingPlan = (access.data as any)?.pending_plan as "starter" | "pro" | undefined;
  const planKey = pendingPlan && pendingPlan in PLAN_PRICING ? pendingPlan : "starter";
  const pricing = PLAN_PRICING[planKey];

  const onCheckout = async () => {
    const orgId = (access.data as any)?.organization_id ?? null;
    console.info("[payment-required] click fired", {
      pending_plan: pendingPlan ?? null,
      organization_id: orgId,
    });
    setCheckoutError(null);
    if (!pendingPlan || (pendingPlan !== "starter" && pendingPlan !== "pro")) {
      const msg = t("payment.checkoutErrorSupport", {
        defaultValue: "Checkout could not be started. Please contact support.",
      });
      console.warn("[payment-required] no/invalid pending_plan; aborting", { pendingPlan });
      setCheckoutError(msg);
      return;
    }
    setSubmitting(true);
    console.info("[payment-required] createCheckoutSession() started", {
      pending_plan: pendingPlan,
      organization_id: orgId,
    });
    try {
      const raw: any = await checkout({ data: { plan: pendingPlan } });
      // Normalize possible response shapes -> { url: string }
      const url: string | null =
        (raw && typeof raw === "object" && (raw.url ?? raw.checkoutUrl ?? raw.session?.url)) || null;
      console.info("[payment-required] createCheckoutSession() response", {
        pending_plan: pendingPlan,
        organization_id: orgId,
        response_keys: raw && typeof raw === "object" ? Object.keys(raw) : null,
        redirect_url_exists: !!url,
      });
      if (!url) {
        const msg = t("payment.checkoutErrorSupport", {
          defaultValue: "Checkout could not be started. Please contact support.",
        });
        setCheckoutError(msg);
        setSubmitting(false);
        return;
      }
      console.info("[payment-required] redirecting via window.location.assign");
      window.location.assign(url);
    } catch (e: any) {
      const message = e?.message ?? String(e);
      console.error("[payment-required] createCheckoutSession() threw", {
        pending_plan: pendingPlan,
        organization_id: orgId,
        message,
      });
      setCheckoutError(message || t("payment.checkoutErrorSupport", {
        defaultValue: "Checkout could not be started. Please contact support.",
      }));
      setSubmitting(false);
    }
  };

  if (loading || !session || access.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 shadow-soft">
        <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <CreditCard className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-center">
          {t("payment.title", { defaultValue: "Payment required" })}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground text-center">
          {t("payment.body", {
            plan: pricing.label,
            defaultValue: `Complete your payment to activate your ${pricing.label} plan.`,
          })}
        </p>

        <div className="mt-6 rounded-xl border bg-muted/30 p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{pricing.label}</span>
            <span className="text-base font-semibold">
              {pricing.monthly}
              <span className="text-xs font-normal text-muted-foreground">
                {t("payment.perMonth", { defaultValue: "/month" })}
              </span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">
              {pricing.setupLabel}
            </span>
            <span className="text-sm font-medium">{pricing.setup}</span>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            {t("payment.taxNote", { defaultValue: "Tax calculated at checkout." })} · {t("landing.pricing.satisfactionGuarantee", { defaultValue: "30-Day Satisfaction Guarantee" })}
          </p>
        </div>


        {checkoutError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {checkoutError}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={onCheckout} disabled={submitting || !pendingPlan} className="w-full h-11">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("payment.redirecting", { defaultValue: "Redirecting to checkout…" })}
              </>
            ) : (
              <>
                {t("payment.continueCheckout", { defaultValue: "Continue to Checkout" })}
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
          <Button asChild variant="outline" className="w-full h-11">
            <Link to="/" hash="pricing">
              {t("payment.changePlan", { defaultValue: "Change plan" })}
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full h-11">
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              {t("payment.contactSupport", { defaultValue: "Contact support on WhatsApp" })}
            </a>
          </Button>
          <Button
            variant="ghost"
            className="w-full h-10 text-xs text-muted-foreground"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> {t("nav.signOut")}
          </Button>
        </div>
      </div>
    </div>
  );
}
