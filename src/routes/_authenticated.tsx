import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { Boxes } from "lucide-react";
import { getMyAccessStatus } from "@/lib/admin.functions";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEnabledModules } from "@/lib/use-modules";
import { moduleForPath, MODULE_LABELS } from "@/lib/modules";
import { useProfile } from "@/lib/profile";
import { ModuleDisabled } from "@/components/ModuleDisabled";
import { usePermissions } from "@/lib/use-permissions";
import { permissionForPath } from "@/lib/permissions";
import { ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // IMPORTANT: All hooks must be declared at the top before any conditional
  // returns. Adding/reordering hooks below an early return causes React #310
  // (hook order mismatch) on subsequent renders.
  const { session, loading } = useAuth();
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
        <ModuleGate pathname={pathname}>
          <Outlet />
        </ModuleGate>
      </ErrorBoundary>
    </AppLayout>
  );
}

function ModuleGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const profile = useProfile();
  const { modules, isLoading } = useEnabledModules();
  const perms = usePermissions();
  const { t } = useTranslation();
  const isSuper = profile.data?.role === "super_admin";
  const moduleKey = moduleForPath(pathname);
  if (isSuper || isLoading || perms.isLoading) return <>{children}</>;
  if (moduleKey && !modules[moduleKey]) {
    return <ModuleDisabled label={MODULE_LABELS[moduleKey]} />;
  }
  const requiredPerm = permissionForPath(pathname);
  if (requiredPerm && !perms.can(requiredPerm)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md text-center space-y-3 p-6">
          <ShieldOff className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">
            {t("permissions.deniedTitle", "Permission required")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("permissions.deniedBody", "You don't have access to this section. Ask your organization owner to grant the required permission.")}
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
