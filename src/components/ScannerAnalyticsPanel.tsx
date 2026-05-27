import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getScannerAnalytics,
  getScannerActivity,
} from "@/lib/scanner-analytics.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Activity,
  TrendingUp,
  MapPin,
  PackagePlus,
  ArrowLeftRight,
  Scan,
} from "lucide-react";

function relTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function ScannerAnalyticsPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const fetchAnalytics = useServerFn(getScannerAnalytics);
  const fetchActivity = useServerFn(getScannerActivity);

  const a = useQuery({
    queryKey: ["scanner-analytics"],
    queryFn: () => fetchAnalytics(),
    enabled: open,
    staleTime: 60_000,
  });
  const act = useQuery({
    queryKey: ["scanner-activity"],
    queryFn: () => fetchActivity(),
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          {t("scanner.analytics.title")}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-5">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric
              icon={Scan}
              label={t("scanner.analytics.scansToday")}
              value={a.data?.scansToday ?? "—"}
            />
            <Metric
              icon={PackagePlus}
              label={t("scanner.analytics.receivingToday")}
              value={a.data?.receivingToday ?? "—"}
            />
            <Metric
              icon={ArrowLeftRight}
              label={t("scanner.analytics.transfersToday")}
              value={a.data?.transfersToday ?? "—"}
            />
            <Metric
              icon={MapPin}
              label={t("scanner.analytics.busiestLocation")}
              value={a.data?.busiestLocation?.name ?? "—"}
              small
            />
          </div>

          {/* Top products */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              {t("scanner.analytics.topProducts")}
            </h3>
            {a.data && a.data.topProducts.length > 0 ? (
              <ul className="divide-y divide-border text-sm">
                {a.data.topProducts.map((p, i) => (
                  <li
                    key={i}
                    className="py-1.5 flex items-center justify-between gap-3"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ×{p.count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("scanner.analytics.empty")}
              </p>
            )}
          </div>

          {/* Activity */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              {t("scanner.activity.title")}
            </h3>
            {act.data && act.data.length > 0 ? (
              <ul className="divide-y divide-border text-sm max-h-72 overflow-y-auto">
                {act.data.map((e) => (
                  <li
                    key={e.id}
                    className="py-1.5 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">
                        {e.product_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {e.user_email ?? "—"}
                        {e.quantity_change != null
                          ? ` · ${e.quantity_change > 0 ? "+" : ""}${e.quantity_change}`
                          : ""}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {relTime(e.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("scanner.activity.empty")}
              </p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: any;
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/30 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <Icon className="h-3 w-3" />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={
          small
            ? "mt-1 text-sm font-semibold truncate"
            : "mt-1 text-xl font-bold"
        }
      >
        {value}
      </div>
    </div>
  );
}
