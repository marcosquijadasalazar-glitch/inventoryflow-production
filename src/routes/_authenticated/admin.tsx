import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Building2,
  Users,
  Package,
  Plus,
  UserPlus,
  MoreHorizontal,
  History,
  Inbox,
  Mail as MailIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/lib/profile";
import {
  adminListOrganizations,
  adminGetStats,
  adminCreateOrganization,
  adminUpdateOrgPlan,
  adminListUsers,
  adminCreateUser,
  adminAssignUser,
  adminSetOrganizationStatus,
  adminSetUserStatus,
  adminSetAccountStatus,
  adminListAuditLog,
  adminResetUserPassword,
} from "@/lib/admin.functions";
import { adminUpdateOrgModules } from "@/lib/modules.functions";
import {
  MODULE_KEYS,
  MODULE_LABELS,
  MODULE_PRESETS,
  PRESET_NAMES,
  detectPreset,
  normalizeModules,
  type ModuleKey,
  type ModuleMap,
  type PresetName,
} from "@/lib/modules";
import { Switch } from "@/components/ui/switch";
import { Settings2, Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { deleteUserSecure, deleteOrganizationSecure } from "@/lib/delete.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const PLANS = ["free", "starter", "pro", "enterprise"] as const;
const ROLES = ["super_admin", "owner", "manager", "employee"] as const;
const STATUSES = ["active", "inactive", "suspended", "archived"] as const;
type Status = (typeof STATUSES)[number];

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-success/15 text-success border-success/30" },
    inactive: { label: "Inactive", cls: "bg-muted text-muted-foreground" },
    suspended: { label: "Suspended", cls: "bg-warning/15 text-warning border-warning/30" },
    archived: { label: "Archived", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const s = map[status] ?? map.inactive;
  return (
    <Badge variant="outline" className={s.cls}>
      {s.label}
    </Badge>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const profile = useProfile();

  useEffect(() => {
    if (!profile.isLoading && profile.data && profile.data.role !== "super_admin") {
      toast.error("Super admin access required");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [profile.isLoading, profile.data, navigate]);

  const listOrgs = useServerFn(adminListOrganizations);
  const getStats = useServerFn(adminGetStats);
  const listUsers = useServerFn(adminListUsers);
  const listAudit = useServerFn(adminListAuditLog);

  const enabled = profile.data?.role === "super_admin";

  const orgs = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => listOrgs({}), enabled });
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => getStats({}), enabled });
  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers({ data: {} }),
    enabled,
  });
  const audit = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => listAudit({}),
    enabled,
  });

  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const refetchAll = () => {
    orgs.refetch();
    users.refetch();
    stats.refetch();
    audit.refetch();
  };

  if (profile.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (profile.data?.role !== "super_admin") return null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            Platform
          </p>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Super Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage companies, users, statuses, and audit history.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateUserOpen(true)}>
            <UserPlus className="h-4 w-4" /> Create user
          </Button>
          <Button onClick={() => setCreateOrgOpen(true)}>
            <Plus className="h-4 w-4" /> New company
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Building2}
          label="Companies"
          value={stats.data?.organizations}
          sub={`${stats.data?.activeOrganizations ?? 0} active`}
        />
        <StatCard icon={Users} label="Users" value={stats.data?.users} />
        <StatCard icon={Package} label="Products" value={stats.data?.products} />
        <StatCard icon={Package} label="Movements" value={stats.data?.movements} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" /> New Access Requests
            {(users.data ?? []).filter((u: any) => u.account_status === "pending_approval").length > 0 && (
              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                {(users.data ?? []).filter((u: any) => u.account_status === "pending_approval").length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AccessRequestsTable
            users={(users.data ?? []).filter((u: any) => u.account_status === "pending_approval")}
            loading={users.isLoading}
            onChanged={refetchAll}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Companies
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <OrgsTable orgs={orgs.data ?? []} loading={orgs.isLoading} onChanged={refetchAll} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Users
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <UsersTable
            users={users.data ?? []}
            orgs={orgs.data ?? []}
            loading={users.isLoading}
            onChanged={refetchAll}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Admin audit log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AuditTable rows={audit.data ?? []} loading={audit.isLoading} />
        </CardContent>
      </Card>

      <CreateOrgDialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
        onCreated={refetchAll}
      />
      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        orgs={orgs.data ?? []}
        onCreated={refetchAll}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: number | undefined;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className="text-2xl font-semibold mt-1.5">
          {value === undefined ? "—" : value.toLocaleString()}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

type OrgRow = {
  id: string;
  company_name: string;
  business_type: string | null;
  plan_type: (typeof PLANS)[number];
  active_status: boolean;
  is_active: boolean;
  suspended_at: string | null;
  archived_at: string | null;
  subscription_status: string | null;
  status: Status;
  user_count: number;
  product_count: number;
  enabled_modules?: Partial<Record<ModuleKey, boolean>> | null;
  created_at: string;
};

function OrgsTable({
  orgs,
  loading,
  onChanged,
}: {
  orgs: OrgRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const setStatus = useServerFn(adminSetOrganizationStatus);
  const updatePlan = useServerFn(adminUpdateOrgPlan);
  const deleteOrg = useServerFn(deleteOrganizationSecure);
  const [modulesOrg, setModulesOrg] = useState<OrgRow | null>(null);
  const [deleteOrgRow, setDeleteOrgRow] = useState<OrgRow | null>(null);

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: Status }) =>
      setStatus({ data: { organization_id: vars.id, status: vars.status } }),
    onSuccess: () => {
      toast.success("Company status updated");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const planMut = useMutation({
    mutationFn: (vars: { id: string; plan: (typeof PLANS)[number] }) =>
      updatePlan({ data: { organization_id: vars.id, plan_type: vars.plan } }),
    onSuccess: () => {
      toast.success("Plan updated");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (orgs.length === 0)
    return <p className="p-6 text-sm text-muted-foreground">No companies yet.</p>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Users</TableHead>
            <TableHead className="text-right">Products</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <div className="font-medium">{o.company_name}</div>
                {o.business_type && (
                  <div className="text-xs text-muted-foreground">{o.business_type}</div>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={o.plan_type}
                  onValueChange={(v) => planMut.mutate({ id: o.id, plan: v as any })}
                >
                  <SelectTrigger className="h-8 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <StatusBadge status={o.status} />
              </TableCell>
              <TableCell className="text-right font-mono">{o.user_count}</TableCell>
              <TableCell className="text-right font-mono">{o.product_count}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setModulesOrg(o)}
                    title="Modules"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline ml-1">Modules</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Status</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => statusMut.mutate({ id: o.id, status: "active" })}
                      >
                        Reactivate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => statusMut.mutate({ id: o.id, status: "inactive" })}
                      >
                        Deactivate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => statusMut.mutate({ id: o.id, status: "suspended" })}
                      >
                        Suspend
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => statusMut.mutate({ id: o.id, status: "archived" })}
                      >
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteOrgRow(o)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete company…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ModulesDialog
        org={modulesOrg}
        onOpenChange={(open) => !open && setModulesOrg(null)}
        onSaved={onChanged}
      />
      <DeleteConfirmDialog
        open={!!deleteOrgRow}
        onOpenChange={(o) => !o && setDeleteOrgRow(null)}
        texts={{
          title: "Delete company",
          description:
            "This archives the company and revokes access for all its members. Inventory history, orders, payments, movements and audit logs are preserved.",
          targetLabel: deleteOrgRow?.company_name ?? null,
        }}
        onConfirm={async ({ password, reason }) => {
          await deleteOrg({
            data: {
              organization_id: deleteOrgRow!.id,
              password,
              confirmation: "DELETE",
              reason,
            },
          });
          toast.success("Company deleted");
          onChanged();
        }}
      />
    </div>
  );
}

function ModulesDialog({
  org,
  onOpenChange,
  onSaved,
}: {
  org: OrgRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const updateModules = useServerFn(adminUpdateOrgModules);
  const [modules, setModules] = useState<ModuleMap>(() => normalizeModules(org?.enabled_modules));
  const [preset, setPreset] = useState<PresetName>("custom");

  useEffect(() => {
    if (org) {
      const m = normalizeModules(org.enabled_modules);
      setModules(m);
      setPreset(detectPreset(m));
    }
  }, [org]);

  const mut = useMutation({
    mutationFn: (m: ModuleMap) =>
      updateModules({ data: { organization_id: org!.id, modules: m } }),
    onSuccess: () => {
      toast.success("Modules updated");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const applyPreset = (name: PresetName) => {
    setPreset(name);
    if (name !== "custom") setModules(MODULE_PRESETS[name]);
  };

  const toggle = (key: ModuleKey, value: boolean) => {
    const next = { ...modules, [key]: value };
    setModules(next);
    setPreset(detectPreset(next));
  };

  return (
    <Dialog open={!!org} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modules — {org?.company_name}</DialogTitle>
          <DialogDescription>
            Toggle which features this company can access. Disabled modules are hidden from the sidebar and blocked at the route.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Preset plan</Label>
            <Select value={preset} onValueChange={(v) => applyPreset(v as PresetName)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESET_NAMES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1 border-t pt-3">
            {MODULE_KEYS.map((k) => (
              <label
                key={k}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 cursor-pointer"
              >
                <span className="text-sm">{MODULE_LABELS[k]}</span>
                <Switch checked={modules[k]} onCheckedChange={(v) => toggle(k, v)} />
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate(modules)}
            disabled={mut.isPending || !org}
          >
            {mut.isPending ? "Saving…" : "Save modules"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type UserRow = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: (typeof ROLES)[number];
  organization_id: string | null;
  is_active: boolean;
  suspended_at: string | null;
  archived_at: string | null;
  status: Status;
  account_status?:
    | "pending_approval" | "trial_active" | "active" | "suspended" | "cancelled" | "rejected"
    | null;
  trial_ends_at?: string | null;
  company_name?: string | null;
  business_type?: string | null;
  phone?: string | null;
  created_at: string;
};

function AccessRequestsTable({
  users,
  loading,
  onChanged,
}: {
  users: UserRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const setAccountStatus = useServerFn(adminSetAccountStatus);
  const mut = useMutation({
    mutationFn: (vars: {
      user_id: string;
      status: "trial_active" | "active" | "rejected";
      trial_days?: number;
    }) => setAccountStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Access request updated");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (users.length === 0)
    return <p className="p-6 text-sm text-muted-foreground">No pending access requests.</p>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Business type</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Signup date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="font-medium">{u.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </TableCell>
              <TableCell className="text-sm">{u.company_name ?? "—"}</TableCell>
              <TableCell className="text-sm">{u.business_type ?? "—"}</TableCell>
              <TableCell className="text-sm font-mono">{u.phone ?? "—"}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {new Date(u.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                  Pending
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      mut.mutate({ user_id: u.user_id, status: "trial_active", trial_days: 14 })
                    }
                    disabled={mut.isPending}
                  >
                    Approve trial
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => mut.mutate({ user_id: u.user_id, status: "active" })}
                    disabled={mut.isPending}
                  >
                    Approve active
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    disabled={!u.email}
                  >
                    <a
                      href={u.email ? `mailto:${u.email}?subject=${encodeURIComponent("Your InventoryFlow access request")}` : "#"}
                    >
                      <MailIcon className="h-3.5 w-3.5" /> Contact
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => mut.mutate({ user_id: u.user_id, status: "rejected" })}
                    disabled={mut.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UsersTable({
  users,
  orgs,
  loading,
  onChanged,
}: {
  users: UserRow[];
  orgs: OrgRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const assign = useServerFn(adminAssignUser);
  const setStatus = useServerFn(adminSetUserStatus);
  const setAccountStatus = useServerFn(adminSetAccountStatus);
  const deleteUser = useServerFn(deleteUserSecure);
  const [deleteUserRow, setDeleteUserRow] = useState<UserRow | null>(null);

  const assignMut = useMutation({
    mutationFn: (vars: {
      user_id: string;
      organization_id: string | null;
      role?: (typeof ROLES)[number];
    }) => assign({ data: vars }),
    onSuccess: () => {
      toast.success("User updated");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: (vars: { user_id: string; status: Status }) =>
      setStatus({ data: { user_id: vars.user_id, status: vars.status } }),
    onSuccess: () => {
      toast.success("User status updated");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const accountMut = useMutation({
    mutationFn: (vars: {
      user_id: string;
      status: "pending_approval" | "trial_active" | "active" | "suspended" | "cancelled" | "rejected";
      trial_days?: number;
    }) => setAccountStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Account status updated");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const orgMap = useMemo(() => {
    const m = new Map<string, string>();
    orgs.forEach((o) => m.set(o.id, o.company_name));
    return m;
  }, [orgs]);

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (users.length === 0)
    return <p className="p-6 text-sm text-muted-foreground">No users yet.</p>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="font-medium">{u.full_name ?? u.email}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </TableCell>
              <TableCell>
                <Select
                  value={u.role}
                  onValueChange={(v) =>
                    assignMut.mutate({
                      user_id: u.user_id,
                      organization_id: u.organization_id,
                      role: v as any,
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={u.organization_id ?? "__none"}
                  onValueChange={(v) =>
                    assignMut.mutate({
                      user_id: u.user_id,
                      organization_id: v === "__none" ? null : v,
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-[200px]">
                    <SelectValue
                      placeholder={
                        u.organization_id
                          ? orgMap.get(u.organization_id) ?? "Unknown"
                          : "Unassigned"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <StatusBadge status={u.status} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <Badge variant="outline" className="w-fit capitalize text-[10px]">
                    {(u.account_status ?? "active").replace("_", " ")}
                  </Badge>
                  {u.account_status === "trial_active" && u.trial_ends_at && (
                    <span className="text-[10px] text-muted-foreground">
                      ends {new Date(u.trial_ends_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Approval</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => accountMut.mutate({ user_id: u.user_id, status: "active" })}
                    >
                      Approve / Activate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => accountMut.mutate({ user_id: u.user_id, status: "trial_active", trial_days: 14 })}
                    >
                      Start 14-day Trial
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => accountMut.mutate({ user_id: u.user_id, status: "suspended" })}
                    >
                      Suspend
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => accountMut.mutate({ user_id: u.user_id, status: "cancelled" })}
                    >
                      Cancel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => accountMut.mutate({ user_id: u.user_id, status: "rejected" })}
                    >
                      Reject
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Legacy Status</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => statusMut.mutate({ user_id: u.user_id, status: "active" })}
                    >
                      Reactivate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => statusMut.mutate({ user_id: u.user_id, status: "inactive" })}
                    >
                      Deactivate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => statusMut.mutate({ user_id: u.user_id, status: "suspended" })}
                    >
                      Suspend (legacy)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => statusMut.mutate({ user_id: u.user_id, status: "archived" })}
                    >
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteUserRow(u)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete user…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DeleteConfirmDialog
        open={!!deleteUserRow}
        onOpenChange={(o) => !o && setDeleteUserRow(null)}
        texts={{
          title: "Delete user",
          description:
            "This deactivates the user's login and archives their profile. Audit logs and history are preserved. Consider suspending instead if this is temporary.",
          targetLabel: deleteUserRow?.email ?? deleteUserRow?.full_name ?? null,
        }}
        onConfirm={async ({ password, reason }) => {
          await deleteUser({
            data: {
              user_id: deleteUserRow!.user_id,
              password,
              confirmation: "DELETE",
              reason,
            },
          });
          toast.success("User deleted");
          onChanged();
        }}
      />
    </div>
  );
}

function AuditTable({
  rows,
  loading,
}: {
  rows: Array<{
    id: string;
    action_type: string;
    target_type: string;
    target_label: string | null;
    performed_by_email: string | null;
    previous_status: string | null;
    new_status: string | null;
    reason: string | null;
    created_at: string;
  }>;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-32 w-full" />;
  if (rows.length === 0)
    return <p className="p-6 text-sm text-muted-foreground">No admin actions yet.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>By</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs whitespace-nowrap">
                {new Date(r.created_at).toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{r.action_type}</Badge>
              </TableCell>
              <TableCell>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {r.target_type}
                </div>
                <div className="text-sm">{r.target_label ?? "—"}</div>
              </TableCell>
              <TableCell className="text-xs font-mono">
                {(r.previous_status ?? "—") + " → " + (r.new_status ?? "—")}
              </TableCell>
              <TableCell className="text-xs">{r.performed_by_email ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const create = useServerFn(adminCreateOrganization);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [plan, setPlan] = useState<(typeof PLANS)[number]>("free");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await create({
        data: {
          company_name: name.trim(),
          business_type: type.trim() || null,
          plan_type: plan,
        },
      });
      toast.success("Company created");
      setName("");
      setType("");
      setPlan("free");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>
            Create a new tenant organization on the platform.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Business type</Label>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Warehouse, retail, distributor…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  orgs,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgs: OrgRow[];
  onCreated: () => void;
}) {
  const create = useServerFn(adminCreateUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("owner");
  const [orgId, setOrgId] = useState<string>("__none");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 8) {
      toast.error("Email and 8+ char password required");
      return;
    }
    setSaving(true);
    try {
      await create({
        data: {
          email: email.trim(),
          password,
          full_name: fullName.trim() || null,
          role,
          organization_id: orgId === "__none" ? null : orgId,
        },
      });
      toast.success("User created");
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("owner");
      setOrgId("__none");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      const { parsePlanLimitError } = await import("@/lib/plan-limits");
      if (parsePlanLimitError(e)) {
        toast.error("Plan user limit reached for this organization. Upgrade the plan to continue.");
      } else {
        toast.error(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Provision a new user and assign them to a company.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Unassigned</SelectItem>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
