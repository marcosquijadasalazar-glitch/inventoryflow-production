import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listTransactionHistory, type TransactionRow } from "@/lib/history";
import { getCompanySettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Search,
  FileText,
  History as HistoryIcon,
  X,
} from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { exportHistoryPdf } from "@/lib/pdf";
import { exportHistoryXlsx } from "@/lib/xlsx-export";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

const TYPES = [
  "product_created",
  "product_updated",
  "product_deleted",
  "stock_added",
  "stock_removed",
  "stock_adjusted",
  "low_stock",
] as const;

const SOURCES = ["manual", "barcode_scan", "adjustment", "system"] as const;

function typeColor(t: TransactionRow["type"]) {
  switch (t) {
    case "stock_added":
      return "bg-success/15 text-[oklch(0.4_0.12_155)] border-success/25";
    case "stock_removed":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "stock_adjusted":
      return "bg-primary/10 text-primary border-primary/25";
    case "low_stock":
      return "bg-warning/15 text-[oklch(0.45_0.12_70)] border-warning/30";
    case "product_created":
      return "bg-success/10 text-[oklch(0.4_0.12_155)] border-success/20";
    case "product_deleted":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function HistoryPage() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: listTransactionHistory,
  });
  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: getCompanySettings,
  });

  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("__all");
  const [source, setSource] = useState<string>("__all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== "__all" && r.type !== type) return false;
      if (source !== "__all" && r.source !== source) return false;
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
      if (term) {
        const hay = [r.product_name, r.sku, r.barcode, r.user_email, r.reason]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, type, source, from, to]);

  const reset = () => {
    setQ("");
    setType("__all");
    setSource("__all");
    setFrom("");
    setTo("");
  };

  const exportCsv = () => {
    const headers = [
      "date",
      "type",
      "source",
      "product",
      "sku",
      "barcode",
      "qty",
      "previous",
      "new",
      "reason",
      "user",
    ];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(","),
      ...filtered.map((r) =>
        [
          new Date(r.created_at).toISOString(),
          r.type,
          r.source,
          r.product_name,
          r.sku,
          r.barcode,
          r.quantity_change,
          r.previous_stock,
          r.new_stock,
          r.reason,
          r.user_email,
        ]
          .map(escape)
          .join(","),
      ),
    ].join("\n");
    downloadCsv(`history-${Date.now()}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-primary" />
            {t("history.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("history.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> {t("common.exportCsv")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportHistoryXlsx(filtered)}
          >
            <Download className="h-4 w-4 mr-1.5" /> {t("common.exportXlsx")}
          </Button>
          <Button
            size="sm"
            onClick={() => exportHistoryPdf(filtered, settings ?? null)}
          >
            <FileText className="h-4 w-4 mr-1.5" /> {t("common.exportPdf")}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("common.filters")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("common.search")}
              className="pl-9"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder={t("history.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("common.all")}</SelectItem>
              {TYPES.map((tp) => (
                <SelectItem key={tp} value={tp}>
                  {t(`history.types.${tp}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue placeholder={t("history.source")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("common.all")}</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`history.sources.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label={t("history.from")}
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label={t("history.to")}
            />
          </div>
          {(q || type !== "__all" || source !== "__all" || from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="justify-self-start md:col-span-5"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              {t("common.clear")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("history.type")}</TableHead>
                <TableHead>{t("history.source")}</TableHead>
                <TableHead>{t("history.product")}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">{t("history.qty")}</TableHead>
                <TableHead className="text-right">{t("history.prev")}</TableHead>
                <TableHead className="text-right">{t("history.new")}</TableHead>
                <TableHead>{t("common.reason")}</TableHead>
                <TableHead>{t("history.user")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center py-10 text-muted-foreground"
                  >
                    {t("common.noResults")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={typeColor(r.type) + " text-xs"}
                      >
                        {t(`history.types.${r.type}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t(`history.sources.${r.source}`)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.product_name ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.sku ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.quantity_change ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.previous_stock ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {r.new_stock ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {r.reason ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.user_email ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
