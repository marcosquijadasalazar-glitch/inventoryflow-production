import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/lib/profile";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  MANAGEABLE_ROLES,
  isDefaultGranted,
  type AppPermission,
  type ManageableRole,
} from "@/lib/permissions";
import {
  getOrgPermissionMatrix,
  setRolePermission,
  resetRolePermission,
  setUserPermission,
} from "@/lib/permissions.functions";

export const Route = createFileRoute("/_authenticated/permissions")({
  component: PermissionsPage,
});

function PermissionsPage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const qc = useQueryClient();
  const fetchMatrix = useServerFn(getOrgPermissionMatrix);
  const role = profile.data?.role;

  const canAccess = role === "owner" || role === "manager" || role === "super_admin";

  const matrix = useQuery({
    queryKey: ["permission-matrix", profile.data?.organization_id],
    queryFn: () => fetchMatrix({ data: {} }),
    enabled: canAccess,
  });

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["permission-matrix"] });
    qc.invalidateQueries({ queryKey: ["my-permissions"] });
  };

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

      {matrix.isLoading ? (
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : matrix.error ? (
        <div className="text-sm text-destructive">{(matrix.error as Error).message}</div>
      ) : matrix.data ? (
        <Tabs defaultValue="roles">
          <TabsList>
            <TabsTrigger value="roles">{t("permissions.tabRoles", "By Role")}</TabsTrigger>
            <TabsTrigger value="users">{t("permissions.tabUsers", "By User")}</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="mt-4">
            <RoleMatrix
              orgId={matrix.data.organizationId}
              rolePermissions={matrix.data.rolePermissions as RolePermRow[]}
              onChanged={invalidate}
            />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <UserOverrides
              members={matrix.data.members as Member[]}
              userPermissions={matrix.data.userPermissions as UserPermRow[]}
              onChanged={invalidate}
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

type RolePermRow = {
  organization_id: string;
  role: ManageableRole;
  permission: AppPermission;
  granted: boolean;
};
type UserPermRow = {
  user_id: string;
  organization_id: string;
  permission: AppPermission;
  granted: boolean;
};
type Member = { user_id: string; email: string | null; full_name: string | null; role: string };

function RoleMatrix({
  orgId,
  rolePermissions,
  onChanged,
}: {
  orgId: string;
  rolePermissions: RolePermRow[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const setFn = useServerFn(setRolePermission);
  const resetFn = useServerFn(resetRolePermission);

  const overrideMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rolePermissions) m.set(`${r.role}:${r.permission}`, r.granted);
    return m;
  }, [rolePermissions]);

  const isEffective = (role: ManageableRole, perm: AppPermission) => {
    const o = overrideMap.get(`${role}:${perm}`);
    if (o !== undefined) return o;
    return isDefaultGranted(role, perm);
  };

  const hasOverride = (role: ManageableRole, perm: AppPermission) =>
    overrideMap.has(`${role}:${perm}`);

  const toggle = async (role: ManageableRole, perm: AppPermission, next: boolean) => {
    try {
      await setFn({ data: { organizationId: orgId, role, permission: perm, granted: next } });
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const reset = async (role: ManageableRole, perm: AppPermission) => {
    try {
      await resetFn({ data: { organizationId: orgId, role, permission: perm } });
      onChanged();
      toast.success(t("permissions.resetDone", "Reset to default"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className="text-base">
              {t(`permissions.group.${group.key}`, group.key)}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4 font-medium">{t("permissions.permission", "Permission")}</th>
                  {MANAGEABLE_ROLES.map((r) => (
                    <th key={r} className="py-2 px-3 font-medium text-center">
                      {t(`permissions.role.${r}`, r)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.perms.map((perm) => (
                  <tr key={perm} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{t(`permissions.perm.${perm}`, perm)}</div>
                    </td>
                    {MANAGEABLE_ROLES.map((r) => (
                      <td key={r} className="py-2 px-3 text-center">
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={isEffective(r, perm)}
                            onCheckedChange={(v) => toggle(r, perm, v)}
                            disabled={r === "owner"}
                          />
                          {hasOverride(r, perm) && r !== "owner" && (
                            <button
                              type="button"
                              title={t("permissions.reset", "Reset to default")}
                              onClick={() => reset(r, perm)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">
        {t(
          "permissions.ownerNote",
          "Owners always have all permissions and cannot be restricted.",
        )}
      </p>
    </div>
  );
}

function UserOverrides({
  members,
  userPermissions,
  onChanged,
}: {
  members: Member[];
  userPermissions: UserPermRow[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>(members[0]?.user_id ?? "");
  const setFn = useServerFn(setUserPermission);

  const selectedMember = members.find((m) => m.user_id === selected);
  const overrides = useMemo(() => {
    const m = new Map<AppPermission, boolean>();
    for (const r of userPermissions) {
      if (r.user_id === selected) m.set(r.permission, r.granted);
    }
    return m;
  }, [userPermissions, selected]);

  const memberRole = (selectedMember?.role ?? "employee") as ManageableRole;

  const change = async (perm: AppPermission, value: "grant" | "deny" | "inherit") => {
    try {
      await setFn({
        data: {
          userId: selected,
          permission: perm,
          granted: value === "inherit" ? null : value === "grant",
        },
      });
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (members.length === 0) {
    return <div className="text-sm text-muted-foreground">{t("permissions.noMembers", "No team members yet.")}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex flex-col sm:flex-row sm:items-center gap-3">
          <span>{t("permissions.user", "User")}</span>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full sm:w-[320px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name ?? m.email} · {m.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2 pr-4 font-medium">{t("permissions.permission", "Permission")}</th>
              <th className="py-2 px-3 font-medium text-center">{t("permissions.effective", "Effective")}</th>
              <th className="py-2 px-3 font-medium text-center">{t("permissions.override", "Override")}</th>
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((perm) => {
              const override = overrides.get(perm);
              const fromRole =
                DEFAULT_ROLE_PERMISSIONS[memberRole]?.includes(perm) ?? false;
              const effective = override === undefined ? fromRole : override;
              const value = override === undefined ? "inherit" : override ? "grant" : "deny";
              return (
                <tr key={perm} className="border-b last:border-0">
                  <td className="py-2 pr-4">{t(`permissions.perm.${perm}`, perm)}</td>
                  <td className="py-2 px-3 text-center">
                    <Badge variant={effective ? "default" : "outline"}>
                      {effective ? t("permissions.allowed", "Allowed") : t("permissions.denied", "Denied")}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Select value={value} onValueChange={(v) => change(perm, v as "grant" | "deny" | "inherit")}>
                      <SelectTrigger className="w-[140px] mx-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">{t("permissions.inherit", "Inherit from role")}</SelectItem>
                        <SelectItem value="grant">{t("permissions.grant", "Grant")}</SelectItem>
                        <SelectItem value="deny">{t("permissions.deny", "Deny")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
