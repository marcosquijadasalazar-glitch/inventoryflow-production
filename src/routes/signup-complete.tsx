import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSignupSession, type SignupStatus } from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Search = { session_id?: string };

export const Route = createFileRoute("/signup-complete")({
  head: () => ({
    meta: [
      { title: "Welcome to InventoryFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: SignupCompletePage,
});

function SignupCompletePage() {
  const { session_id } = Route.useSearch();
  const fetchStatus = useServerFn(getSignupSession);
  const [state, setState] = useState<SignupStatus | { status: "loading" } | { status: "error"; message: string }>({ status: "loading" });
  const triesRef = useRef(0);

  useEffect(() => {
    if (!session_id) {
      setState({ status: "error", message: "Missing session id." });
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetchStatus({ data: { session_id } });
        if (cancelled) return;
        if (res.status === "ready") {
          setState(res);
          return;
        }
        if (res.status === "missing") {
          setState({ status: "error", message: "We could not find your checkout session." });
          return;
        }
        triesRef.current += 1;
        if (triesRef.current > 40) {
          setState({ status: "error", message: "Provisioning is taking longer than expected. Please check your email." });
          return;
        }
        setState(res);
        setTimeout(poll, 1500);
      } catch (err: any) {
        if (cancelled) return;
        setState({ status: "error", message: err?.message ?? "Something went wrong." });
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [session_id, fetchStatus]);

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        {state.status === "loading" || state.status === "pending" ? (
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Setting up your workspace…</h1>
            <p className="text-sm text-muted-foreground">
              Payment received. We're provisioning your InventoryFlow account.
            </p>
          </div>
        ) : state.status === "ready" ? (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <CheckCircle2 className="h-8 w-8 mx-auto text-primary" />
              <h1 className="text-xl font-semibold">Welcome to InventoryFlow 🎉</h1>
              <p className="text-sm text-muted-foreground">Your account is ready. Save these credentials — you'll need them to sign in.</p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="font-mono text-sm">{state.email}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy(state.email)}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {state.temp_password ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Temporary password</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <code className="font-mono text-sm break-all">{state.temp_password}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy(state.temp_password!)}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                  <p className="mt-2 text-xs text-amber-600">
                    Shown once. You'll be asked to set a new password on first sign-in.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your account is already active. Use your email to sign in or reset your password.
                </p>
              )}
            </div>

            <Button asChild className="w-full">
              <Link to="/login">Continue to sign in</Link>
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{(state as any).message}</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
