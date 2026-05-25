import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { useProfile } from "@/lib/profile";
import { PermissionsMatrix } from "@/components/PermissionsMatrix";

export const Route = createFileRoute("/_authenticated/permissions")({
  component: PermissionsPage,
});

function PermissionsPage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const role = profile.data?.role;
  const canAccess = role === "owner" || role === "manager" || role === "super_admin";
  if (!canAccess) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t("permissions.title", "Roles & Permissions")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("permissions.subtitle", "Control what each role and user can see and do.")}
        </p>
      </header>
      <PermissionsMatrix />
    </div>
  );
}
