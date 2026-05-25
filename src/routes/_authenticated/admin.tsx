import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  KeyRound,
  Eye,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { Settings2, Trash2, Search, Pencil } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { deleteUserSecure, deleteOrganizationSecure } from "@/lib/delete.functions";
import { updateCompanyProfile } from "@/lib/company-profile.functions";

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
  const [detailOrg, setDetailOrg] = useState<OrgRow | null>(null);

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

  const pendingCount = (users.data ?? []).filter(
    (u: any) => u.account_status === "pending_approval",
  ).length;

  return (
    <div className="space-y-6">
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
            Companies dashboard. Drill into any company for full details.
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

      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-3.5 w-3.5" /> Companies
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <Inbox className="h-3.5 w-3.5" /> Access Requests
            {pendingCount > 0 && (
              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-3.5 w-3.5" /> Global User Search
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="h-3.5 w-3.5" /> Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <Card>
            <CardContent className="p-0">
              <OrgsTable
                orgs={orgs.data ?? []}
                loading={orgs.isLoading}
                onChanged={refetchAll}
                onView={setDetailOrg}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Inbox className="h-4 w-4 text-primary" /> New Access Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AccessRequestsTable
                users={(users.data ?? []).filter(
                  (u: any) => u.account_status === "pending_approval",
                )}
                loading={users.isLoading}
                onChanged={refetchAll}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Global User Search
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
        </TabsContent>

        <TabsContent value="audit">
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
        </TabsContent>
      </Tabs>

      <CompanyDetailSheet
        org={detailOrg}
        orgs={orgs.data ?? []}
        users={users.data ?? []}
        audit={audit.data ?? []}
        onOpenChange={(o) => !o && setDetailOrg(null)}
        onChanged={refetchAll}
      />

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

type OrgSettings = {
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  currency: string | null;
  website: string | null;
  footer_notes: string | null;
  tax_id: string | null;
  logo_url: string | null;
} | null;

type OrgOwner = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  account_status: string | null;
  trial_ends_at: string | null;
} | null;

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
  settings: OrgSettings;
  owner: OrgOwner;
};

type SortKey = "newest" | "oldest" | "name" | "trial_soon";
type TrialFilter = "any" | "trial" | "active" | "pending" | "none";

function OrgsTable({
  orgs,
  loading,
  onChanged,
  onView,
}: {
  orgs: OrgRow[];
  loading: boolean;
  onChanged: () => void;
  onView?: (org: OrgRow) => void;
}) {
  const setStatus = useServerFn(adminSetOrganizationStatus);
  const updatePlan = useServerFn(adminUpdateOrgPlan);
  const deleteOrg = useServerFn(deleteOrganizationSecure);
  const [modulesOrg, setModulesOrg] = useState<OrgRow | null>(null);
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null);
  const [deleteOrgRow, setDeleteOrgRow] = useState<OrgRow | null>(null);

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [trialFilter, setTrialFilter] = useState<TrialFilter>("any");
  const [dateFilter, setDateFilter] = useState<string>("any"); // any | 7d | 30d | 90d
  const [sort, setSort] = useState<SortKey>("newest");

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

  // counters across the whole (unfiltered) list
  const counters = useMemo(() => {
    let active = 0,
      pending = 0,
      trial = 0,
      suspended = 0;
    for (const o of orgs) {
      if (o.status === "suspended") suspended++;
      else if (o.status === "active") active++;
      const acct = o.owner?.account_status;
      if (acct === "pending_approval") pending++;
      if (acct === "trial_active") trial++;
    }
    return { total: orgs.length, active, pending, trial, suspended };
  }, [orgs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const dateWindow =
      dateFilter === "7d" ? 7 :
      dateFilter === "30d" ? 30 :
      dateFilter === "90d" ? 90 : null;

    let list = orgs.filter((o) => {
      if (planFilter !== "all" && o.plan_type !== planFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (trialFilter !== "any") {
        const acct = o.owner?.account_status ?? "";
        if (trialFilter === "trial" && acct !== "trial_active") return false;
        if (trialFilter === "active" && acct !== "active") return false;
        if (trialFilter === "pending" && acct !== "pending_approval") return false;
        if (trialFilter === "none" && acct) return false;
      }
      if (dateWindow !== null) {
        const age = (now - new Date(o.created_at).getTime()) / 86400000;
        if (age > dateWindow) return false;
      }
      if (q) {
        const hay = [
          o.company_name,
          o.owner?.full_name,
          o.owner?.email,
          o.owner?.phone,
          o.settings?.email,
          o.settings?.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name":
          return a.company_name.localeCompare(b.company_name);
        case "trial_soon": {
          const at = a.owner?.trial_ends_at ? new Date(a.owner.trial_ends_at).getTime() : Infinity;
          const bt = b.owner?.trial_ends_at ? new Date(b.owner.trial_ends_at).getTime() : Infinity;
          return at - bt;
        }
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return list;
  }, [orgs, search, planFilter, statusFilter, trialFilter, dateFilter, sort]);

  return (
    <div>
      {/* counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 border-b border-border">
        <Counter label="Total" value={counters.total} />
        <Counter label="Active" value={counters.active} tone="success" />
        <Counter label="Pending" value={counters.pending} tone="warning" />
        <Counter label="Trial" value={counters.trial} tone="primary" />
        <Counter label="Suspended" value={counters.suspended} tone="destructive" />
      </div>

      {/* filters bar */}
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, owner, email, phone…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="h-9 w-[120px]"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={trialFilter} onValueChange={(v) => setTrialFilter(v as TrialFilter)}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Trial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any account</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="active">Active account</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="none">No owner</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Created" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any date</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="name">Company name</SelectItem>
            <SelectItem value="trial_soon">Trial ending soon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-32 w-full m-4" />
      ) : filtered.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">No companies match.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="font-medium">{o.company_name}</div>
                    {o.business_type && (
                      <div className="text-xs text-muted-foreground">{o.business_type}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{o.owner?.full_name ?? "—"}</div>
                    <div className="text-muted-foreground">{o.owner?.email ?? o.settings?.email ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={o.plan_type}
                      onValueChange={(v) => planMut.mutate({ id: o.id, plan: v as any })}
                    >
                      <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLANS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <Badge variant="outline" className="w-fit capitalize text-[10px]">
                        {(o.owner?.account_status ?? "—").replace("_", " ")}
                      </Badge>
                      {o.owner?.account_status === "trial_active" && o.owner.trial_ends_at && (
                        <span className="text-[10px] text-muted-foreground">
                          ends {new Date(o.owner.trial_ends_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{o.user_count}</TableCell>
                  <TableCell className="text-right font-mono">{o.product_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onView && (
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => onView(o)} title="View details">
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline ml-1">View</span>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditOrg(o)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline ml-1">Edit</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => setModulesOrg(o)} title="Modules">
                        <Settings2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline ml-1">Modules</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Status</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => statusMut.mutate({ id: o.id, status: "active" })}>Reactivate</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => statusMut.mutate({ id: o.id, status: "inactive" })}>Deactivate</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => statusMut.mutate({ id: o.id, status: "suspended" })}>Suspend</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => statusMut.mutate({ id: o.id, status: "archived" })}>Archive</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOrgRow(o)}>
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
        </div>
      )}

      <ModulesDialog org={modulesOrg} onOpenChange={(open) => !open && setModulesOrg(null)} onSaved={onChanged} />
      <EditOrgDialog org={editOrg} onOpenChange={(open) => !open && setEditOrg(null)} onSaved={onChanged} />
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

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "primary" | "destructive";
}) {
  const cls =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "primary" ? "text-primary" :
    tone === "destructive" ? "text-destructive" :
    "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}

function EditOrgDialog({
  org,
  onOpenChange,
  onSaved,
}: {
  org: OrgRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const saveProfile = useServerFn(updateCompanyProfile);
  const updatePlan = useServerFn(adminUpdateOrgPlan);
  const setOrgStatus = useServerFn(adminSetOrganizationStatus);

  const [form, setForm] = useState({
    company_name: "",
    business_type: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    country: "",
    timezone: "",
    currency: "",
    website: "",
    footer_notes: "",
    plan_type: "free" as (typeof PLANS)[number],
    status: "active" as Status,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org) return;
    const s = org.settings ?? ({} as any);
    setForm({
      company_name: org.company_name ?? "",
      business_type: org.business_type ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      city: s.city ?? "",
      country: s.country ?? "",
      timezone: s.timezone ?? "",
      currency: s.currency ?? "",
      website: s.website ?? "",
      footer_notes: s.footer_notes ?? "",
      plan_type: org.plan_type,
      status: org.status,
    });
  }, [org]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await saveProfile({
        data: {
          organizationId: org.id,
          values: {
            company_name: form.company_name || null,
            business_type: form.business_type || null,
            phone: form.phone || null,
            email: form.email || null,
            address: form.address || null,
            city: form.city || null,
            country: form.country || null,
            timezone: form.timezone || null,
            currency: form.currency || null,
            website: form.website || null,
            footer_notes: form.footer_notes || null,
          },
        },
      });
      if (form.plan_type !== org.plan_type) {
        await updatePlan({ data: { organization_id: org.id, plan_type: form.plan_type } });
      }
      if (form.status !== org.status) {
        await setOrgStatus({ data: { organization_id: org.id, status: form.status } });
      }
      toast.success("Company updated");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!org} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit company — {org?.company_name}</DialogTitle>
          <DialogDescription>
            Super admin edit. Changes apply across the organization and are recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          <Field label="Company name"><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
          <Field label="Business type"><Input value={form.business_type} onChange={(e) => set("business_type", e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Country"><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
          <Field label="Timezone"><Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="America/New_York" /></Field>
          <Field label="Currency"><Input value={form.currency} onChange={(e) => set("currency", e.target.value)} maxLength={10} placeholder="USD" /></Field>
          <Field label="Website" className="sm:col-span-2"><Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
          <Field label="Notes" className="sm:col-span-2">
            <Input value={form.footer_notes} onChange={(e) => set("footer_notes", e.target.value)} />
          </Field>
          <Field label="Plan">
            <Select value={form.plan_type} onValueChange={(v) => set("plan_type", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.company_name.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
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
  const resetPassword = useServerFn(adminResetUserPassword);
  const [deleteUserRow, setDeleteUserRow] = useState<UserRow | null>(null);
  const [resetUserRow, setResetUserRow] = useState<UserRow | null>(null);
  const { t } = useTranslation();

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
  const resetMut = useMutation({
    mutationFn: (vars: { user_id: string }) =>
      resetPassword({ data: { user_id: vars.user_id } }),
    onSuccess: () => {
      toast.success(t("admin.resetSent"));
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
                    <DropdownMenuItem onClick={() => setResetUserRow(u)}>
                      <KeyRound className="h-3.5 w-3.5 mr-2" /> {t("admin.sendPasswordReset")}
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
      <Dialog open={!!resetUserRow} onOpenChange={(o) => !o && setResetUserRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> {t("admin.resetConfirmTitle")}
            </DialogTitle>
            <DialogDescription>{t("admin.resetConfirmDesc")}</DialogDescription>
          </DialogHeader>
          {resetUserRow?.email && (
            <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm">
              <span className="font-mono">{resetUserRow.email}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetUserRow(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!resetUserRow) return;
                resetMut.mutate({ user_id: resetUserRow.user_id });
                setResetUserRow(null);
              }}
              disabled={resetMut.isPending}
            >
              {resetMut.isPending ? t("admin.resetSending") : t("admin.resetSendBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
