import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Globe,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/lib/profile";
import { getPresenceSnapshot, getSecurityActivity } from "@/lib/security.functions";
import {
  SECURITY_ACTIONS,
  SECURITY_CATEGORIES,
  SECURITY_SEVERITIES,
  type SecurityCategory,
  type SecuritySeverity,
} from "@/lib/security-constants";

export const Route = createFileRoute("/_authenticated/security-activity")({
  component: () => <Navigate to="/settings" search={{ tab: "security" } as any} replace />,
});

const PAGE_SIZE = 50;

function ago(iso: string | null | undefined) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Active now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  const d = Math.floor(ms / 86_400_000);
  return `${d}d ago`;
}

function prettyAction(action: string) {
  return action.replace(/_/g, " ");
}

function SeverityBadge({ severity }: { severity: string | null }) {
  const s = (severity ?? "info") as SecuritySeverity;
  if (s === "critical")
    return (
      <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
        <ShieldAlert className="h-3 w-3 mr-1" />
        Critical
      </Badge>
    );
  if (s === "warning")
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Warning
      </Badge>
    );
  return <Badge variant="secondary">Info</Badge>;
}

function CategoryBadge({ category }: { category: string | null }) {
  const c = (category ?? "auth") as SecurityCategory;
  const map: Record<SecurityCategory, string> = {
    auth: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    billing: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    access: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    security: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={map[c]}>
      {c}
    </Badge>
  );
}

export function SecurityActivityPage() {
  const profile = useProfile();
  const role = profile.data?.role;
  const canView = role === "owner" || role === "manager" || role === "super_admin";
  const isSuper = role === "super_admin";
  const fetchActivity = useServerFn(getSecurityActivity);
  const fetchPresence = useServerFn(getPresenceSnapshot);

  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("__all");
  const [category, setCategory] = useState<string>("__all");
  const [severity, setSeverity] = useState<string>("__all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ecosystem, setEcosystem] = useState(false);
  const [page, setPage] = useState(0);

  const scope = ecosystem && isSuper ? "ecosystem" : "org";

  const activity = useQuery({
    queryKey: [
      "security-activity",
      search,
      action,
      category,
      severity,
      dateFrom,
      dateTo,
      scope,
      page,
    ],
    queryFn: () =>
      fetchActivity({
        data: {
          search: search || null,
          action: action === "__all" ? null : (action as any),
          category: category === "__all" ? null : (category as any),
          severity: severity === "__all" ? null : (severity as any),
          date_from: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString() : null,
          date_to: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : null,
          scope,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      }),
    enabled: canView,
  });

  const presence = useQuery({
    queryKey: ["security-presence"],
    queryFn: () => fetchPresence({}),
    enabled: canView,
    refetchInterval: 45_000,
  });

  const onlineRows = useMemo(
    () =>
      ((presence.data?.rows ?? []) as any[]).filter((r) => {
        const ms = Date.now() - new Date(r.last_seen_at).getTime();
        return r.is_online && ms <= 120_000;
      }),
    [presence.data?.rows],
  );

  const rows = (activity.data?.rows ?? []) as any[];
  const total = activity.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const criticalCount = rows.filter((r) => r.severity === "critical").length;

  if (!canView) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Security Activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign-ins, access changes, billing events, and suspicious activity — append-only and timestamped.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSuper && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="ecosystem" className="text-sm cursor-pointer">
                Ecosystem view
              </Label>
              <Switch
                id="ecosystem"
                checked={ecosystem}
                onCheckedChange={(v) => {
                  setEcosystem(v);
                  setPage(0);
                }}
              />
            </div>
          )}
          <Badge variant="secondary">{onlineRows.length} online</Badge>
          {criticalCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground">
              {criticalCount} critical on this page
            </Badge>
          )}
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Currently online</CardTitle>
          <span className="text-xs text-muted-foreground">Last 2 minutes</span>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Device</th>
                <th className="py-2 pr-4 font-medium">Browser</th>
                <th className="py-2 pr-4 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {onlineRows.map((r) => (
                <tr key={r.user_id} className="border-b last:border-0">
                  <td className="py-2 pr-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {r.full_name ?? r.email ?? "—"}
                  </td>
                  <td className="py-2 pr-4">{r.role ?? "—"}</td>
                  <td className="py-2 pr-4">{r.device ?? "—"}</td>
                  <td className="py-2 pr-4">{r.browser ?? "—"}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{ago(r.last_seen_at)}</td>
                </tr>
              ))}
              {onlineRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No one's active right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Event log
            {scope === "ecosystem" && (
              <Badge variant="outline" className="ml-2">
                Ecosystem
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Input
              className="lg:col-span-2"
              placeholder="Search user, action, browser…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All categories</SelectItem>
                {SECURITY_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={severity}
              onValueChange={(v) => {
                setSeverity(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All severities</SelectItem>
                {SECURITY_SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={action}
              onValueChange={(v) => {
                setAction(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All actions</SelectItem>
                {SECURITY_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {prettyAction(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2 md:col-span-3 lg:col-span-6">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Severity</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">User</th>
                  {scope === "ecosystem" && (
                    <th className="py-2 pr-4 font-medium">Organization</th>
                  )}
                  <th className="py-2 pr-4 font-medium">Device</th>
                  <th className="py-2 pr-4 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b last:border-0 ${
                      r.severity === "critical" ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                      <div>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</div>
                      <div className="text-xs">{ago(r.created_at)}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <SeverityBadge severity={r.severity} />
                    </td>
                    <td className="py-2 pr-4">
                      <CategoryBadge category={r.category} />
                    </td>
                    <td className="py-2 pr-4 font-medium capitalize">
                      {prettyAction(r.action)}
                    </td>
                    <td className="py-2 pr-4">{r.email ?? "—"}</td>
                    {scope === "ecosystem" && (
                      <td className="py-2 pr-4 text-muted-foreground">
                        {r.organization_name ?? "—"}
                      </td>
                    )}
                    <td className="py-2 pr-4 text-muted-foreground">
                      {[r.browser, r.device, r.os].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {r.ip_address ?? "—"}
                    </td>
                  </tr>
                ))}
                {!activity.isLoading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={scope === "ecosystem" ? 8 : 7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No events match these filters yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {total > 0
                ? `Showing ${page * PAGE_SIZE + 1}–${Math.min(
                    (page + 1) * PAGE_SIZE,
                    total,
                  )} of ${total}`
                : "0 events"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || activity.isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= pageCount || activity.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
