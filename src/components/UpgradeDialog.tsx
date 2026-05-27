import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Crown, Mail, Users, Package, MapPin, Clock, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  fmtLimit,
  limitFor,
  PLAN_LIMITS,
  recommendedPlan,
  remainingFor,
  trialDaysRemaining,
  type OrgUsage,
  type PlanType,
  type UsageKind,
} from "@/lib/plan-limits";
import { useOrgUsage } from "@/lib/use-org-usage";

const SALES_EMAIL = "sales@inventoryflowapp.com";

type Reason = UsageKind | "feature";

type OpenArgs = {
  reason?: Reason;
  featureLabel?: string;
};

type Ctx = {
  open: (args?: OpenArgs) => void;
};

const UpgradeCtx = createContext<Ctx | null>(null);

export function useUpgradeModal() {
  const ctx = useContext(UpgradeCtx);
  if (!ctx) {
    // Safe fallback: noop. Avoid crashing if used outside provider.
    return { open: () => {} };
  }
  return ctx;
}

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [args, setArgs] = useState<OpenArgs>({});
  const usageQ = useOrgUsage();

  const ctx = useMemo<Ctx>(
    () => ({
      open: (a) => {
        setArgs(a ?? {});
        setOpen(true);
      },
    }),
    [],
  );

  return (
    <UpgradeCtx.Provider value={ctx}>
      {children}
      <UpgradeDialog
        open={open}
        onOpenChange={setOpen}
        usage={usageQ.data ?? null}
        reason={args.reason}
        featureLabel={args.featureLabel}
      />
    </UpgradeCtx.Provider>
  );
}

const KIND_ICON: Record<UsageKind, typeof Users> = {
  users: Users,
  products: Package,
  locations: MapPin,
};

export function PlanBadge({ plan }: { plan: PlanType }) {
  const { t } = useTranslation();
  const isEnt = plan === "enterprise";
  return (
    <Badge
      variant="outline"
      className={
        isEnt
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : plan === "pro"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted/60"
      }
    >
      <Crown className="h-3 w-3 mr-1" />
      {t(`plan.tiers.${plan}`, plan.charAt(0).toUpperCase() + plan.slice(1))}
    </Badge>
  );
}

export function TrialBadge({ trialEndsAt }: { trialEndsAt: string | null | undefined }) {
  const { t } = useTranslation();
  const days = trialDaysRemaining(trialEndsAt);
  if (days == null) return null;
  if (days <= 0) {
    return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
        <Clock className="h-3 w-3 mr-1" />
        {t("plan.trialExpired", "Trial expired")}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={
        days <= 3
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-primary/30 bg-primary/10 text-primary"
      }
    >
      <Clock className="h-3 w-3 mr-1" />
      {t("plan.trialDaysLeft", { count: days, defaultValue: "{{count}} days left in trial" })}
    </Badge>
  );
}

export function UpgradeDialog({
  open,
  onOpenChange,
  usage,
  reason,
  featureLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usage: OrgUsage | null;
  reason?: Reason;
  featureLabel?: string;
}) {
  const { t } = useTranslation();
  const plan = usage?.plan ?? "free";
  const isEnterprise = plan === "enterprise";
  const target = recommendedPlan(plan, reason && reason !== "feature" ? reason : undefined);

  const handleContactSales = useCallback(() => {
    const subject = encodeURIComponent(t("plan.salesSubject", "Enterprise plan inquiry"));
    const body = encodeURIComponent(
      t("plan.salesBody", "Hi, I'd like to learn more about your Enterprise plan."),
    );
    window.location.href = `mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`;
  }, [t]);

  const headline = (() => {
    if (!usage) return t("plan.upgradeTitle", "Ready to scale? Upgrade your plan");
    if (reason === "feature") {
      return t("plan.featureGrowthTitle", {
        defaultValue: "Unlock {{feature}} by upgrading from {{plan}}",
        feature: featureLabel ?? t("plan.thisFeature", "this capability"),
        plan: t(`plan.tiers.${plan}`, plan),
      });
    }
    if (reason) {
      const lim = limitFor(usage, reason);
      const used = usage.used[reason];
      return t("plan.growthHeadline", {
        defaultValue: "Congratulations 🎉 Your business is growing — you've reached the {{plan}} {{kind}} capacity ({{used}}/{{max}}).",
        kind: t(`plan.kinds.${reason}`),
        plan: t(`plan.tiers.${plan}`, plan),
        used,
        max: fmtLimit(lim),
      });
    }
    return t("plan.upgradeTitle", "Ready to scale? Upgrade your plan");
  })();

  const subline = isEnterprise
    ? t("plan.alreadyEnterprise", "You're on our top plan. Contact sales for custom needs.")
    : t("plan.growthRecommendation", {
        defaultValue: "Upgrade to {{plan}} to continue scaling — {{benefit}}.",
        plan: t(`plan.tiers.${target}`, target),
        benefit:
          reason === "users"
            ? t("plan.benefits.users", "invite more team members")
            : reason === "products"
            ? t("plan.benefits.products", "grow your catalog")
            : reason === "locations"
            ? t("plan.benefits.locations", "expand to more locations")
            : t("plan.benefits.generic", "unlock more capacity for your operations"),
      });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-lg p-0 overflow-hidden">
        {/* Header gradient */}
        <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-5 border-b border-border">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] flex items-center justify-center shadow-soft">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {usage?.organization_name ?? t("plan.yourWorkspace", "Your workspace")}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <PlanBadge plan={plan} />
                  <TrialBadge trialEndsAt={usage?.trial_ends_at} />
                </div>
              </div>
            </div>
          </div>
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg leading-tight">{headline}</DialogTitle>
            <DialogDescription className="text-sm">{subline}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Usage breakdown */}
        {usage && (
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("plan.currentUsage", "Current usage")}
            </p>
            <UsageRow usage={usage} kind="users" highlight={reason === "users"} />
            <UsageRow usage={usage} kind="products" highlight={reason === "products"} />
            <UsageRow usage={usage} kind="locations" highlight={reason === "locations"} />
          </div>
        )}

        {/* Recommendation card */}
        {!isEnterprise && (
          <div className="mx-6 mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {t("plan.recommendedTitle", {
                    defaultValue: "Recommended: {{plan}}",
                    plan: t(`plan.tiers.${target}`, target),
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {planSummary(target, t)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:order-1">
            {t("common.cancel", "Cancel")}
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={handleContactSales}
            className="sm:order-2"
          >
            <Mail className="h-4 w-4 mr-1.5" />
            {t("plan.contactSales", "Contact sales")}
          </Button>
          {!isEnterprise && (
            <Button asChild className="sm:order-3">
              <a href="/settings#plan" onClick={() => onOpenChange(false)}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                {t("plan.upgradeCta", "Upgrade plan")}
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function planSummary(plan: PlanType, t: (k: string, v?: any) => string): string {
  const l = PLAN_LIMITS[plan];
  return t("plan.tierSummary", {
    defaultValue: "{{users}} users · {{products}} products · {{locations}} locations",
    users: fmtLimit(l.max_users),
    products: fmtLimit(l.max_products),
    locations: fmtLimit(l.max_locations),
  });
}

function UsageRow({
  usage,
  kind,
  highlight,
}: {
  usage: OrgUsage;
  kind: UsageKind;
  highlight?: boolean;
}) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[kind];
  const lim = limitFor(usage, kind);
  const used = usage.used[kind];
  const remaining = remainingFor(usage, kind);
  const pct = lim == null ? 0 : Math.min(100, Math.round((used / lim) * 100));
  const at = lim != null && used >= lim;
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/20"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 text-sm">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{t(`plan.kinds.${kind}`)}</span>
        </div>
        <span className={`text-sm tabular-nums font-medium ${at ? "text-amber-600 dark:text-amber-400" : ""}`}>
          {used} / {fmtLimit(lim)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${at ? "bg-amber-500" : pct >= 80 ? "bg-amber-400" : "bg-primary"}`}
          style={{ width: lim == null ? "6%" : `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        {lim == null
          ? t("plan.unlimited", "Unlimited on your plan")
          : remaining === 0
          ? t("plan.noneRemaining", "No more available — upgrade to add more")
          : t("plan.remaining", { count: remaining ?? 0, defaultValue: "{{count}} remaining" })}
      </p>
    </div>
  );
}
