import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createSignupCheckoutSession } from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

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
  const start = useServerFn(createSignupCheckoutSession);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const isStarter = plan === "starter";
  const heading = isStarter ? "Start your 7-day free trial" : "Get Pro";
  const sub = isStarter
    ? "Card required. You won't be charged for the subscription during your trial."
    : "Instant activation after payment.";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      const { url } = await start({ data: { plan, email: email.trim().toLowerCase() } });
      window.location.href = url;
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start checkout");
      setBusy(false);
    }
  };

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
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {isStarter ? "Starter Plan" : "Pro Plan"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || !email}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isStarter ? "Continue to Stripe Checkout" : "Continue to payment"}
            </Button>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
              You'll set your company details, password, and inventory after payment.
              Onboarding Process fee is charged once.
            </p>
          </form>

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
