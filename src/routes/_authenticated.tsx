import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { Boxes, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyAccessStatus } from "@/lib/admin.functions";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
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

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login", replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session || access.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] flex items-center justify-center shadow-soft">
            <Boxes className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-muted border-t-primary animate-spin" />
            Loading workspace…
          </div>
        </div>
      </div>
    );
  }

  if (access.data && !access.data.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center bg-card border rounded-2xl p-8 shadow-soft">
          <div className="mx-auto h-14 w-14 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {t("access.blockedTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("access.blockedBody")}
          </p>
          <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
            {t("access.statusLabel")}:{" "}
            <span className="font-mono">{access.data.reason}</span> ({access.data.scope})
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
          >
            <LogOut className="h-4 w-4" /> {t("nav.signOut")}
          </Button>
        </div>
      </div>
    );
  }

  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
