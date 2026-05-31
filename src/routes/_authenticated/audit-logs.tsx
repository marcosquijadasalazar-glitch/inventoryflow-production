import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardList,
  Package,
  ArrowLeftRight,
  MapPin,
  ScanLine,
  Shield,
  Activity,
  ChevronDown,
  ChevronRight,
  Globe,
  Building2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import {
  listOperationalAudit,
  listOperationalAuditActions,
  operationalAuditStats,
  categorizeAction,
  type OperationalAuditRow,
} from "@/lib/audit.functions";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  component: () => <Navigate to="/settings" search={{ tab: "audit" } as any} replace />,
});

const PAGE_SIZE = 50;

const CATEGORY_META: Record<
  string,
  { label: string; icon: typeof Package; tone: string }
> = {
  products: { label: "Products", icon: Package, tone: "text-primary" },
  inventory: { label: "Inventory", icon: ScanLine, tone: "text-success" },
  transfers: {
    label: "Transfers",
    icon: ArrowLeftRight,
    tone: "text-blue-500",
  },
  locations: { label: "Locations", icon: MapPin, tone: "text-amber-500" },
  access: { label: "Access", icon: Shield, tone: "text-rose-500" },
  other: { label: "Other", icon: Activity, tone: "text-muted-foreground" },
};

function categoryBadge(action: string) {
  const cat = categorizeAction(action);
  const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Icon className={cn("h-3.5 w-3.5", meta.tone)} />
      <span className="text-muted-foreground">{meta.label}</span>
    </span>
  );
}

function quantityDelta(row: OperationalAuditRow): string | null {
  const m = (row.metadata ?? {}) as Record<string, any>;
  if (typeof m.stock_before === "number" && typeof m.stock_after === "number") {
    const diff = m.stock_after - m.stock_before;
    if (diff === 0) return null;
    return `${diff > 0 ? "+" : ""}${diff} (${m.stock_before} → ${m.stock_after})`;
  }
  if (typeof m.quantity === "number" && m.type) {
    const sign = m.type === "remove" ? "-" : m.type === "add" ? "+" : "";
    return `${sign}${m.quantity}`;
  }
  if (m.from_status && m.to_status) {
    return `${m.from_status} → ${m.to_status}`;
  }
  if (m.from_role && m.to_role) {
    return `${m.from_role} → ${m.to_role}`;
  }
  return null;
}

function AuditRow({ row }: { row: OperationalAuditRow }) {
  const [open, setOpen] = useState(false);
  const delta = quantityDelta(row);
  const hasMeta =
    row.metadata &&
    typeof row.metadata === "object" &&
    Object.keys(row.metadata as object).length > 0;

  return (
    <>
      <tr className="border-b last:border-0 align-top hover:bg-muted/30">
        <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleString()}
        </td>
        <td className="py-2.5 pr-3">
          <div className="flex flex-col gap-1">
            {categoryBadge(row.action_type)}
            <Badge
              variant="secondary"
              className="font-mono text-[10px] w-fit"
            >
              {row.action_type}
            </Badge>
          </div>
        </td>
        <td className="py-2.5 pr-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {row.entity_type}
          </div>
          <div className="font-medium text-sm truncate max-w-[220px]">
            {row.entity_label ?? "—"}
          </div>
        </td>
        <td className="py-2.5 pr-3 text-sm">{row.summary ?? "—"}</td>
        <td className="py-2.5 pr-3 whitespace-nowrap">
          {delta ? (
            <Badge variant="outline" className="font-mono text-xs">
              {delta}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        <td className="py-2.5 pr-3 text-xs text-muted-foreground truncate max-w-[180px]">
          {row.actor_email ?? "system"}
        </td>
        <td className="py-2.5 pr-1 text-right">
          {hasMeta && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle details"
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </td>
      </tr>
      {open && hasMeta && (
        <tr className="border-b bg-muted/20">
          <td colSpan={7} className="px-3 py-3">
            <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export function AuditLogsPage() {
  const profile = useProfile();
  const role = profile.data?.role;
  const canView = role === "owner" || role === "super_admin";
  const isSuper = role === "super_admin";


  const fetchList = useServerFn(listOperationalAudit);
  const fetchActions = useServerFn(listOperationalAuditActions);
  const fetchStats = useServerFn(operationalAuditStats);

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("__all");
  const [entityType, setEntityType] = useState("__all");
  const [category, setCategory] = useState("__all");
  const [scope, setScope] = useState<"org" | "ecosystem">("org");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const actionsQ = useQuery({
    queryKey: ["op-audit-actions"],
    queryFn: () => fetchActions({}),
    enabled: canView,
  });

  const statsQ = useQuery({
    queryKey: ["op-audit-stats", scope],
    queryFn: () => fetchStats({ data: { scope } }),
    enabled: canView,
  });

  const listQ = useQuery({
    queryKey: [
      "op-audit",
      search,
      action,
      entityType,
      category,
      scope,
      dateFrom,
      dateTo,
      page,
    ],
    queryFn: () =>
      fetchList({
        data: {
          search: search || null,
          action: action === "__all" ? null : action,
          entity_type: entityType === "__all" ? null : entityType,
          category: category === "__all" ? null : category,
          scope,
          date_from: dateFrom
            ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString()
            : null,
          date_to: dateTo
            ? new Date(`${dateTo}T23:59:59.999Z`).toISOString()
            : null,
          page,
          page_size: PAGE_SIZE,
        },
      }),
    enabled: canView,
  });

  const total = listQ.data?.total ?? 0;
  const rows = listQ.data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summaryCards = useMemo(() => {
    const s = statsQ.data;
    if (!s) return null;
    const cats = Object.entries(s.by_category);
    return { total: s.total_24h, actors: s.active_users_24h, cats };
  }, [statsQ.data]);

  if (!canView) return <Navigate to="/dashboard" replace />;

  const resetFilters = () => {
    setSearch("");
    setAction("__all");
    setEntityType("__all");
    setCategory("__all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Immutable investigation record with full before/after detail, actor
            attribution, and metadata. For day-to-day operational activity, use
            the Activity feed.
          </p>
        </div>
        {isSuper && (
          <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => {
                setScope("org");
                setPage(0);
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-sm inline-flex items-center gap-1.5 transition-colors",
                scope === "org"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              My organization
            </button>
            <button
              type="button"
              onClick={() => {
                setScope("ecosystem");
                setPage(0);
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-sm inline-flex items-center gap-1.5 transition-colors",
                scope === "ecosystem"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              Ecosystem
            </button>
          </div>
        )}
      </header>

      {summaryCards && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Events · last 24h
              </div>
              <div className="text-2xl font-semibold mt-1">
                {summaryCards.total.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Active operators · last 24h
              </div>
              <div className="text-2xl font-semibold mt-1">
                {summaryCards.actors.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                By category · 24h
              </div>
              <div className="flex flex-wrap gap-1.5">
                {summaryCards.cats.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No activity yet.
                  </span>
                )}
                {summaryCards.cats.map(([cat, n]) => {
                  const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
                  const Icon = meta.icon;
                  return (
                    <Badge
                      key={cat}
                      variant="outline"
                      className="font-normal gap-1"
                    >
                      <Icon className={cn("h-3 w-3", meta.tone)} />
                      {meta.label} · {n}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <Input
            placeholder="Search user, entity, summary…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="md:col-span-2"
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
              {Object.entries(CATEGORY_META).map(([k, m]) => (
                <SelectItem key={k} value={k}>
                  {m.label}
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
              {(actionsQ.data ?? []).map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={entityType}
            onValueChange={(v) => {
              setEntityType(v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All entities</SelectItem>
              <SelectItem value="products">products</SelectItem>
              <SelectItem value="product">product</SelectItem>
              <SelectItem value="transfer_orders">transfer_orders</SelectItem>
              <SelectItem value="locations">locations</SelectItem>
              <SelectItem value="profile">profile</SelectItem>
            </SelectContent>
          </Select>
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
          <div className="md:col-span-6 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Events{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({total.toLocaleString()})
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || listQ.isLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages || listQ.isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No events match your filters yet. Operational changes will appear
              here as your team works.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr className="text-left">
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                    <th className="py-2 pr-3 font-medium">Entity</th>
                    <th className="py-2 pr-3 font-medium">Summary</th>
                    <th className="py-2 pr-3 font-medium">Δ / Change</th>
                    <th className="py-2 pr-3 font-medium">User</th>
                    <th className="py-2 pr-1" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <AuditRow key={r.id} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
