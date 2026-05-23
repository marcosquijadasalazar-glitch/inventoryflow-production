import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtLimit, type OrgUsage, type UsageKind } from "@/lib/plan-limits";

export function PlanLimitBanner({
  usage,
  kind,
}: {
  usage: OrgUsage | null | undefined;
  kind: UsageKind;
}) {
  const { t } = useTranslation();
  if (!usage) return null;
  const limit =
    kind === "users" ? usage.limits.max_users
    : kind === "products" ? usage.limits.max_products
    : usage.limits.max_locations;
  if (limit == null) return null;
  const used = usage.used[kind];
  if (used < limit) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">
          {t("plan.limitReached", "You reached your current plan limit.")}{" "}
          <span className="text-muted-foreground">
            ({t(`plan.kinds.${kind}`)}: {used}/{fmtLimit(limit)})
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {t("plan.upgradePrompt", "Upgrade your plan to continue.")}
        </p>
      </div>
      <Button asChild size="sm" variant="default">
        <Link to="/">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {t("plan.upgradeCta", "Upgrade")}
        </Link>
      </Button>
    </div>
  );
}

export function UsageBar({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number | null;
}) {
  const pct = max == null ? 0 : Math.min(100, Math.round((used / max) * 100));
  const at = max != null && used >= max;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium tabular-nums ${at ? "text-amber-500" : ""}`}>
          {used} / {fmtLimit(max)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${at ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: max == null ? "8%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function UsageSummaryCard({ usage }: { usage: OrgUsage | null | undefined }) {
  const { t } = useTranslation();
  if (!usage) return null;
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{t("plan.usageTitle", "Plan usage")}</p>
          <p className="text-xs text-muted-foreground capitalize">{usage.plan}</p>
        </div>
      </div>
      <div className="space-y-3">
        <UsageBar
          label={t("plan.kinds.users", "Users")}
          used={usage.used.users}
          max={usage.limits.max_users}
        />
        <UsageBar
          label={t("plan.kinds.products", "Products")}
          used={usage.used.products}
          max={usage.limits.max_products}
        />
        <UsageBar
          label={t("plan.kinds.locations", "Locations")}
          used={usage.used.locations}
          max={usage.limits.max_locations}
        />
      </div>
    </div>
  );
}
