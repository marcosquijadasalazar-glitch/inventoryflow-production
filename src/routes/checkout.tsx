import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createSignupCheckoutSession } from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ArrowLeft, AlertTriangle } from "lucide-react";

type CheckoutSearch = { plan?: "starter" | "pro" };

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — InventoryFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): CheckoutSearch => {
    const plan = s.plan;
    return plan === "starter" || plan === "pro" ? { plan } : {};
  },
  component: CheckoutPage,
});

function CheckoutPage() {
  const { plan = "starter" } = Route.useSearch();
  const start = createSignupCheckoutSession;
  const [error, setError] = useState<string | null>(null);

  const isStarter = plan === "starter";
  const heading = isStarter ? "Starting your 7-day free trial…" : "Continuing to checkout…";
  const sub = isStarter
    ? "Card required. You won't be charged during your 7-day trial."
    : "You'll be redirected to Stripe to complete payment.";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { url } = await start({ data: { plan } });
        if (!cancelled) window.location.href = url;
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Could not start checkout");
      }
    })();
    return () => { cancelled = true; };
  }, [plan, start]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-sm font-semibold">InventoryFlow</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {isStarter ? "Starter Plan" : "Pro Plan"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>

          {error ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Back to home</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 max-w-xs">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                Stripe will collect your email and payment method. You'll set your password and company details after checkout.
              </p>
            </div>
          )}

          <p className="mt-6 text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
