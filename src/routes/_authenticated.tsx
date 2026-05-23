import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { Boxes } from "lucide-react";
import { getMyAccessStatus } from "@/lib/admin.functions";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // IMPORTANT: All hooks must be declared at the top before any conditional
  // returns. Adding/reordering hooks below an early return causes React #310
  // (hook order mismatch) on subsequent renders.
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fetchAccess = useServerFn(getMyAccessStatus);
  const access = useQuery({
    queryKey: ["access-status", session?.user?.id],
    queryFn: () => fetchAccess({}),
    enabled: !!session,
    staleTime: 30_000,
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login", replace: true });
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    if (access.error) {
      // eslint-disable-next-line no-console
      console.error("[_authenticated] access-status query failed", {
        userId: session?.user?.id,
        error: (access.error as Error)?.message,
      });
    }
  }, [access.error, session?.user?.id]);

  // Show spinner only while we genuinely don't know yet. If the access query
  // errored, fail-open into the app so the user isn't stuck on a blank screen
  // (server-side RLS still protects every query downstream).
  if (loading || !session || (access.isLoading && !access.error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] flex items-center justify-center shadow-soft">
            <Boxes className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-muted border-t-primary animate-spin" />
            {t("access.loadingWorkspace", { defaultValue: "Loading workspace…" })}
          </div>
        </div>
      </div>
    );
  }


  if (access.data && !access.data.ok) {
    // Redirect to pending-approval page (handles all not-ok scopes)
    if (pathname !== "/pending-approval") {
      navigate({
        to: "/pending-approval",
        replace: true,
        search: { reason: access.data.reason ?? "pending", scope: access.data.scope ?? "account" } as any,
      });
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="h-3.5 w-3.5 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }




  return (
    <AppLayout>
      <ErrorBoundary
        name="AuthenticatedOutlet"
        resetKeys={[pathname]}
        context={{
          userId: session.user.id,
          email: session.user.email,
          pathname,
        }}
      >
        <Outlet />
      </ErrorBoundary>
    </AppLayout>
  );
}
