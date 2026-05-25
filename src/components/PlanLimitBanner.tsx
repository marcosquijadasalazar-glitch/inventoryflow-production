import { useTranslation } from "react-i18next";
import { AlertTriangle, Sparkles, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtLimit, limitFor, type OrgUsage, type UsageKind } from "@/lib/plan-limits";
import { useUpgradeModal, PlanBadge, TrialBadge } from "@/components/UpgradeDialog";

export function PlanLimitBanner({
  usage,
  kind,
}: {
  usage: OrgUsage | null | undefined;
  kind: UsageKind;
}) {
  const { t } = useTranslation();
  const { open } = useUpgradeModal();
  if (!usage) return null;
  const limit = limitFor(usage, kind);
  if (limit == null) return null;
  const used = usage.used[kind];
  if (used < limit) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">
          {t("plan.limitHeadline", {
            defaultValue: "You reached the maximum {{kind}} for {{plan}} ({{used}}/{{max}} used).",
            kind: t(`plan.kinds.${kind}`),
            plan: t(`plan.tiers.${usage.plan}`, usage.plan),
            used,
            max: fmtLimit(limit),
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("plan.upgradePrompt", "Upgrade your plan to continue.")}
        </p>
      </div>
      <Button size="sm" variant="default" onClick={() => open({ reason: kind })}>
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        {t("plan.upgradeCta", "Upgrade plan")}
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
  const near = max != null && !at && pct >= 80;
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
          className={`h-full transition-all ${at ? "bg-amber-500" : near ? "bg-amber-400" : "bg-primary"}`}
          style={{ width: max == null ? "8%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function UsageSummaryCard({ usage }: { usage: OrgUsage | null | undefined }) {
  const { t } = useTranslation();
  const { open } = useUpgradeModal();
  if (!usage) return null;
  const isEnterprise = usage.plan === "enterprise";
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("plan.usageTitle", "Plan usage")}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <PlanBadge plan={usage.plan} />
            <TrialBadge trialEndsAt={usage.trial_ends_at} />
          </div>
        </div>
        <Button size="sm" variant={isEnterprise ? "outline" : "default"} onClick={() => open()}>
          {isEnterprise ? (
            <>
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              {t("plan.contactSales", "Contact sales")}
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {t("plan.upgradeCta", "Upgrade plan")}
            </>
          )}
        </Button>
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
