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
import { toast } from "sonner";

export const Route = createFileRoute("/payment-required")({
  component: PaymentRequiredPage,
  head: () => ({ meta: [{ title: "Payment required · InventoryFlow" }] }),
});

const PLAN_PRICING = {
  starter: { monthly: "$14.99", setup: "$49", label: "Starter" },
  pro: { monthly: "$79", setup: "$99", label: "Pro" },
} as const;

function PaymentRequiredPage() {
  const { t } = useTranslation();
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getMyAccessStatus);
  const checkout = useServerFn(createCheckoutSession);
  const [submitting, setSubmitting] = useState(false);

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
    if (!pendingPlan) return;
    setSubmitting(true);
    try {
      const { url } = await checkout({ data: { plan: pendingPlan } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? t("payment.checkoutError", { defaultValue: "Could not start checkout. Please try again." }));
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
              {t("payment.setupFee", { defaultValue: "One-time setup fee" })}
            </span>
            <span className="text-sm font-medium">{pricing.setup}</span>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            {t("payment.taxNote", { defaultValue: "Tax calculated at checkout." })}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={onCheckout} disabled={submitting || !pendingPlan} className="w-full h-11">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
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
