import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  PackageX,
  Repeat,
  ShoppingCart,
  Flame,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { getInventoryInsights, type InsightsBundle } from "@/lib/insights.functions";
import { cn } from "@/lib/utils";

function useInsights() {
  const fn = useServerFn(getInventoryInsights);
  return useQuery<InsightsBundle>({
    queryKey: ["inventory-insights"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });
}

/** Compact summary card for dashboard */
export function InsightsSummaryCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useInsights();

  const tiles = [
    {
      key: "low_stock_risk_count",
      label: t("insights.lowStockRisk"),
      icon: AlertTriangle,
      tone: "warning" as const,
      value: data?.summary.low_stock_risk_count ?? 0,
    },
    {
      key: "fast_movers_count",
      label: t("insights.fastMovers"),
      icon: Flame,
      tone: "primary" as const,
      value: data?.summary.fast_movers_count ?? 0,
    },
    {
      key: "anomalies_count",
      label: t("insights.anomalies"),
      icon: Activity,
      tone: "danger" as const,
      value: data?.summary.anomalies_count ?? 0,
    },
    {
      key: "dead_inventory_count",
      label: t("insights.deadInventory"),
      icon: PackageX,
      tone: "muted" as const,
      value: data?.summary.dead_inventory_count ?? 0,
    },
  ];

  return (
    <Card className="border-border shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{t("insights.title")}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/scanner">
            {t("insights.view")} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const toneCls =
            tile.tone === "warning"
              ? "bg-warning/10 text-[oklch(0.45_0.12_70)]"
              : tile.tone === "danger"
                ? "bg-destructive/10 text-destructive"
                : tile.tone === "primary"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground";
          return (
            <div
              key={tile.key}
              className="rounded-lg border border-border p-3 flex flex-col gap-2"
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-md flex items-center justify-center",
                  toneCls,
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-2xl font-semibold leading-tight">
                  {isLoading ? "—" : tile.value}
                </div>
                <div className="text-xs text-muted-foreground">{tile.label}</div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Full insights panel used inside scanner page */
export function InsightsPanel() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useInsights();

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground text-center">
          {t("insights.failed")}
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("insights.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-sm text-muted-foreground text-center">
          {t("common.loading")}
        </CardContent>
      </Card>
    );
  }

  const empty =
    data.low_stock_risk.length === 0 &&
    data.reorder_suggestions.length === 0 &&
    data.anomalies.length === 0 &&
    data.fast_movers.length === 0 &&
    data.dead_inventory.length === 0 &&
    data.frequently_scanned.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("insights.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("insights.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {empty && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("insights.empty")}
          </p>
        )}

        {data.frequently_scanned.length > 0 && (
          <Section
            icon={Repeat}
            title={t("insights.frequentlyScanned")}
            tone="primary"
          >
            <ul className="divide-y divide-border">
              {data.frequently_scanned.map((r) => (
                <li
                  key={r.product_id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <Row name={r.name} sku={r.sku} />
                  <Badge variant="outline" className="font-mono">
                    {r.scan_count}× {t("insights.today")}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.low_stock_risk.length > 0 && (
          <Section
            icon={AlertTriangle}
            title={t("insights.lowStockRisk")}
            tone="warning"
          >
            <ul className="divide-y divide-border">
              {data.low_stock_risk.slice(0, 5).map((r) => (
                <li
                  key={r.product_id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <Row
                    name={r.name}
                    sku={r.sku}
                    detail={t("insights.runsOutInDays", {
                      days: r.days_remaining ?? 0,
                    })}
                  />
                  <Badge
                    variant="outline"
                    className="border-warning/30 bg-warning/10 text-[oklch(0.45_0.12_70)] font-mono"
                  >
                    {r.stock} {t("insights.left")}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.reorder_suggestions.length > 0 && (
          <Section
            icon={ShoppingCart}
            title={t("insights.reorderSuggestions")}
            tone="primary"
          >
            <ul className="divide-y divide-border">
              {data.reorder_suggestions.slice(0, 5).map((r) => (
                <li
                  key={r.product_id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <Row
                    name={r.name}
                    sku={r.sku}
                    detail={t("insights.reorderHint", {
                      stock: r.stock,
                      suggested: r.suggested_reorder,
                    })}
                  />
                  {r.recent_velocity > r.baseline_velocity * 1.3 ? (
                    <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.anomalies.length > 0 && (
          <Section
            icon={Activity}
            title={t("insights.anomalies")}
            tone="danger"
          >
            <ul className="divide-y divide-border">
              {data.anomalies.slice(0, 5).map((a) => (
                <li
                  key={`${a.product_id}-${a.kind}`}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <Row name={a.name} sku={a.sku} detail={a.detail} />
                  <Badge
                    variant="outline"
                    className="border-destructive/25 bg-destructive/10 text-destructive text-xs"
                  >
                    {t(`insights.anomalyKind.${a.kind}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.fast_movers.length > 0 && (
          <Section icon={Flame} title={t("insights.fastMovers")} tone="primary">
            <ul className="divide-y divide-border">
              {data.fast_movers.map((m) => (
                <li
                  key={m.product_id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <Row name={m.name} sku={m.sku} />
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {m.total_units} {t("insights.unitsShort")} ·{" "}
                    {m.movement_count} {t("insights.movesShort")}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.dead_inventory.length > 0 && (
          <Section
            icon={PackageX}
            title={t("insights.deadInventory")}
            tone="muted"
          >
            <ul className="divide-y divide-border">
              {data.dead_inventory.slice(0, 5).map((d) => (
                <li
                  key={d.product_id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <Row
                    name={d.name}
                    sku={d.sku}
                    detail={t("insights.noActivityDays", {
                      days: d.days_inactive,
                    })}
                  />
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {d.stock}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: any;
  title: string;
  tone: "primary" | "warning" | "danger" | "muted";
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "warning"
      ? "text-[oklch(0.45_0.12_70)]"
      : tone === "danger"
        ? "text-destructive"
        : tone === "primary"
          ? "text-primary"
          : "text-muted-foreground";
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", toneCls)} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({
  name,
  sku,
  detail,
}: {
  name: string;
  sku: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium truncate">{name}</div>
      <div className="text-xs text-muted-foreground font-mono truncate">
        {sku}
        {detail ? ` · ${detail}` : ""}
      </div>
    </div>
  );
}
