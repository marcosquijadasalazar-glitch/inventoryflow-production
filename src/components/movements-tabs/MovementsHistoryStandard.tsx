import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, X, MoreHorizontal, Copy } from "lucide-react";
import { toast } from "sonner";

import { listMovements, type MovementWithProduct } from "@/lib/inventory";
import { listAllNodes, getBreadcrumb, type LocationNode } from "@/lib/location-tree";
import { listInternalUse } from "@/lib/orders";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportColumn } from "@/lib/exporters";
import { LocationPath } from "@/components/LocationPath";

export type StandardModule =
  | "adjustments"
  | "receiving"
  | "stock-out"
  | "internal-use";

type StandardRow = {
  id: string;
  created_at: string;
  product_name: string | null;
  sku: string | null;
  quantity: number;
  status: string; // always "completed" today
  from_node_id?: string | null;
  from_text?: string | null;
  to_node_id?: string | null;
  to_text?: string | null;
  performed_by?: string | null;
};

const PREFIX: Record<StandardModule, string> = {
  adjustments: "ADJ",
  receiving: "REC",
  "stock-out": "SO",
  "internal-use": "IU",
};

const PLACEHOLDER: Record<StandardModule, string> = {
  adjustments: "Search adjustment #, product, SKU, location, reason…",
  receiving: "Search receiving #, product, SKU, supplier, location…",
  "stock-out": "Search stock out #, product, SKU, location…",
  "internal-use": "Search internal use #, product, SKU, department…",
};

function txnNumber(module: StandardModule, id: string) {
  return `${PREFIX[module]}-${id.slice(-6).toUpperCase()}`;
}

function fromMovement(
  m: MovementWithProduct,
  module: StandardModule,
): StandardRow {
  const productLocId =
    ((m as any).location_id as string | null) ??
    ((m.products as any)?.bin_id as string | null) ??
    null;
  const productLocText = m.products?.location ?? null;

  let from_node_id: string | null = null;
  let from_text: string | null = null;
  let to_node_id: string | null = null;
  let to_text: string | null = null;

  if (module === "receiving") {
    from_text = (m.products as any)?.supplier ?? "Supplier";
    to_node_id = ((m as any).to_location_id as string | null) ?? productLocId;
    to_text = productLocText;
  } else if (module === "stock-out") {
    from_node_id =
      ((m as any).from_location_id as string | null) ?? productLocId;
    from_text = productLocText;
    // Parse customer / reason hint from note
    const note = m.note ?? "";
    to_text = note.includes("customer")
      ? "Customer Order"
      : note.replace(/^\[[^\]]+\]\s*/, "") || "Stock Out";
  } else if (module === "adjustments") {
    from_node_id = productLocId;
    from_text = productLocText;
    to_node_id = productLocId;
    to_text = productLocText;
  }

  return {
    id: m.id,
    created_at: m.created_at,
    product_name: m.products?.name ?? null,
    sku: m.products?.sku ?? null,
    quantity: m.quantity,
    status: "completed",
    from_node_id,
    from_text,
    to_node_id,
    to_text,
    performed_by: null, // inventory_movements has no user_id today
  };
}

function fromInternalUse(h: any): StandardRow {
  const note: string = h.reason ?? "";
  // Extract [Department] prefix if present (createInternalUse stores it)
  const deptMatch = note.match(/^\[([^\]]+)\]/);
  const dept = deptMatch?.[1] ?? "Internal Consumption";
  return {
    id: h.id,
    created_at: h.created_at,
    product_name: h.product_name ?? null,
    sku: h.sku ?? null,
    quantity: Math.abs(h.quantity_change ?? 0),
    status: "completed",
    from_node_id: null,
    from_text: "Stock",
    to_node_id: null,
    to_text: dept,
    performed_by: h.user_email ?? null,
  };
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-success/10 text-[oklch(0.4_0.12_155)]",
  pending: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
  cancelled: "bg-destructive/10 text-destructive",
  rejected: "bg-destructive/10 text-destructive",
};

export function MovementsHistoryStandard({
  module,
  title,
}: {
  module: StandardModule;
  title?: string;
}) {
  const { t } = useTranslation();
  const isInternalUse = module === "internal-use";

  const movementsQ = useQuery({
    queryKey: ["movements"],
    queryFn: listMovements,
    enabled: !isInternalUse,
  });
  const internalQ = useQuery({
    queryKey: ["internal_use"],
    queryFn: listInternalUse,
    enabled: isInternalUse,
  });
  const nodesQ = useQuery({
    queryKey: ["location-nodes-all"],
    queryFn: listAllNodes,
    staleTime: 60_000,
  });
  const nodes: LocationNode[] = nodesQ.data ?? [];

  // Build standard rows scoped to this module
  const rows: StandardRow[] = useMemo(() => {
    if (isInternalUse) {
      return (internalQ.data ?? []).map(fromInternalUse);
    }
    const all = movementsQ.data ?? [];
    const typeFilter: MovementWithProduct["type"] =
      module === "receiving"
        ? "add"
        : module === "stock-out"
          ? "remove"
          : "adjustment";
    // Exclude internal-use records (which appear in transaction_history, not inventory_movements)
    return all
      .filter((m) => m.type === typeFilter)
      .map((m) => fromMovement(m, module));
  }, [isInternalUse, internalQ.data, movementsQ.data, module]);

  // Search + filters
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string>("__all");
  const [fLocation, setFLocation] = useState<string>("__all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const locations = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const fLabel = r.from_node_id
        ? getBreadcrumb(nodes, r.from_node_id).map((n) => n.name).join(" → ")
        : r.from_text ?? "";
      const tLabel = r.to_node_id
        ? getBreadcrumb(nodes, r.to_node_id).map((n) => n.name).join(" → ")
        : r.to_text ?? "";
      if (fLabel) s.add(fLabel);
      if (tLabel) s.add(tLabel);
    });
    return Array.from(s).sort();
  }, [rows, nodes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromT = fFrom ? new Date(fFrom).getTime() : -Infinity;
    const toT = fTo ? new Date(fTo).getTime() + 86_400_000 : Infinity;
    return rows.filter((r) => {
      if (fStatus !== "__all" && r.status !== fStatus) return false;
      const ts = new Date(r.created_at).getTime();
      if (ts < fromT || ts > toT) return false;
      if (fLocation !== "__all") {
        const fLabel = r.from_node_id
          ? getBreadcrumb(nodes, r.from_node_id).map((n) => n.name).join(" → ")
          : r.from_text ?? "";
        const tLabel = r.to_node_id
          ? getBreadcrumb(nodes, r.to_node_id).map((n) => n.name).join(" → ")
          : r.to_text ?? "";
        if (fLabel !== fLocation && tLabel !== fLocation) return false;
      }
      if (q) {
        const hay = [
          txnNumber(module, r.id),
          r.product_name,
          r.sku,
          r.from_text,
          r.to_text,
          r.performed_by,
          r.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, fStatus, fLocation, fFrom, fTo, nodes, module]);

  const activeFilterCount =
    (fStatus !== "__all" ? 1 : 0) +
    (fLocation !== "__all" ? 1 : 0) +
    (fFrom || fTo ? 1 : 0) +
    (search ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setFStatus("__all");
    setFLocation("__all");
    setFFrom("");
    setFTo("");
  };

  // Pagination
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const exportColumns: ExportColumn<StandardRow>[] = [
    { key: "txn", header: "Transaction #", get: (r) => txnNumber(module, r.id) },
    { key: "product", header: "Product", get: (r) => r.product_name ?? "" },
    { key: "sku", header: "SKU", get: (r) => r.sku ?? "" },
    {
      key: "from",
      header: "From",
      get: (r) =>
        r.from_node_id
          ? getBreadcrumb(nodes, r.from_node_id).map((n) => n.name).join(" → ")
          : r.from_text ?? "",
    },
    {
      key: "to",
      header: "To",
      get: (r) =>
        r.to_node_id
          ? getBreadcrumb(nodes, r.to_node_id).map((n) => n.name).join(" → ")
          : r.to_text ?? "",
    },
    { key: "qty", header: "Qty", align: "right", get: (r) => r.quantity },
    { key: "status", header: "Status" },
    {
      key: "date",
      header: "Order Date",
      get: (r) => r.created_at.slice(0, 10),
    },
    { key: "by", header: "Performed By", get: (r) => r.performed_by ?? "" },
  ];

  const heading =
    title ??
    {
      adjustments: t("adj.history", "Adjustment history"),
      receiving: t("rec.history", "Receiving history"),
      "stock-out": t("so.history", "Stock out history"),
      "internal-use": t("iu.history", "Internal use history"),
    }[module];

  const loading = isInternalUse ? internalQ.isLoading : movementsQ.isLoading;

  return (
    <Card className="border-border shadow-soft">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{heading}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {filtered.length} / {rows.length}
            </span>
            <ExportMenu
              title={heading}
              filename={module}
              rows={filtered}
              columns={exportColumns}
              orientation="landscape"
            />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={PLACEHOLDER[module]}
            className="pl-8 bg-surface"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Select value={fStatus} onValueChange={(v) => { setFStatus(v); setPage(1); }}>
            <SelectTrigger className="bg-surface">
              <SelectValue placeholder={t("po.status", "Status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("common.allStatuses", "All statuses")}</SelectItem>
              <SelectItem value="completed">{t("tr.statuses.completed", "completed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fLocation} onValueChange={(v) => { setFLocation(v); setPage(1); }}>
            <SelectTrigger className="bg-surface">
              <SelectValue placeholder={t("common.location", "Location")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("tr.allLocations", "All locations")}</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={fFrom}
            onChange={(e) => { setFFrom(e.target.value); setPage(1); }}
            className="bg-surface"
            aria-label="Start date"
          />
          <Input
            type="date"
            value={fTo}
            onChange={(e) => { setFTo(e.target.value); setPage(1); }}
            className="bg-surface"
            aria-label="End date"
          />
        </div>

        {activeFilterCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered.length} {t("common.results", "results")}
            </span>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="h-3.5 w-3.5" />
              {t("movements.resetFilters", "Reset filters")}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {t("common.noRecords", "No records yet.")}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {t("common.noResults", "No results match your filters.")}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tr.number", "Transaction #")}</TableHead>
                    <TableHead>{t("po.product", "Product")}</TableHead>
                    <TableHead>{t("tr.from", "From")}</TableHead>
                    <TableHead>{t("tr.to", "To")}</TableHead>
                    <TableHead className="text-right">{t("common.quantity", "Qty")}</TableHead>
                    <TableHead>{t("po.status", "Status")}</TableHead>
                    <TableHead>{t("po.order_date", "Order Date")}</TableHead>
                    <TableHead>{t("history.user", "Performed By")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs align-top">
                        {txnNumber(module, r.id)}
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="text-sm font-medium">{r.product_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.sku ?? "—"}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        {r.from_node_id ? (
                          <LocationPath
                            nodeId={r.from_node_id}
                            fallback={r.from_text}
                            nodes={nodes}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.from_text ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {r.to_node_id ? (
                          <LocationPath
                            nodeId={r.to_node_id}
                            fallback={r.to_text}
                            nodes={nodes}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.to_text ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono align-top">
                        {r.quantity}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className={STATUS_COLORS[r.status] ?? ""}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs align-top">
                        {r.created_at.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-xs align-top">
                        {r.performed_by ?? "—"}
                      </TableCell>
                      <TableCell className="align-top">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                navigator.clipboard
                                  ?.writeText(txnNumber(module, r.id))
                                  .then(() => toast.success(t("common.copied", "Copied")))
                                  .catch(() => {});
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              {t("common.copyId", "Copy transaction #")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {t("common.page", "Page")} {pageSafe} / {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t("common.prev", "Previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pageSafe >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {t("common.next", "Next")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
