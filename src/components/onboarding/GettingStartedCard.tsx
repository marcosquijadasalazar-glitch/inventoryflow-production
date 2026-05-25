import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, X, Rocket, Package, Upload, ScanLine, MapPin, Users } from "lucide-react";
import { dismissOnboardingChecklist } from "@/lib/onboarding.functions";
import { useChecklistProgress, useOnboardingState } from "@/lib/use-onboarding";
import { NeedHelpCTA } from "./NeedHelpCTA";

export function GettingStartedCard() {
  const { t } = useTranslation();
  const state = useOnboardingState();
  const progress = useChecklistProgress(state.data?.hasOrg === true);
  const qc = useQueryClient();
  const dismissFn = useServerFn(dismissOnboardingChecklist);
  const dismiss = useMutation({
    mutationFn: () => dismissFn({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-state"] }),
  });

  if (!state.data?.hasOrg) return null;
  if (state.data.org?.onboarding_dismissed) return null;
  if (!progress.data) return null;
  if (progress.data.percent >= 100) return null;
  // Only show to users who can act: owner/manager
  if (state.data.role !== "owner" && state.data.role !== "manager" && state.data.role !== "super_admin") return null;

  const items = [
    { key: "created_product", icon: Package, to: "/products" as const, done: progress.data.items.created_product },
    { key: "imported_products", icon: Upload, to: "/products" as const, done: progress.data.items.imported_products },
    { key: "used_scanner", icon: ScanLine, to: "/scanner" as const, done: progress.data.items.used_scanner },
    { key: "created_location", icon: MapPin, to: "/locations" as const, done: progress.data.items.created_location },
    { key: "invited_employee", icon: Users, to: "/users" as const, done: progress.data.items.invited_employee },
  ];

  return (
    <Card className="border-primary/30 shadow-soft bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">{t("onboarding.checklist.title")}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("onboarding.checklist.progress", { done: progress.data.done, total: progress.data.total })}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          className="h-7 w-7 p-0"
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-[oklch(0.45_0.22_270)] transition-all"
            style={{ width: `${progress.data.percent}%` }}
          />
        </div>
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.key}>
              <Link
                to={it.to}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/60 transition-colors group"
              >
                {it.done ? (
                  <div className="h-5 w-5 rounded-full bg-success/15 text-[oklch(0.45_0.15_155)] flex items-center justify-center shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <it.icon className="h-4 w-4 text-muted-foreground" />
                <span className={`text-sm flex-1 ${it.done ? "line-through text-muted-foreground" : ""}`}>
                  {t(`onboarding.checklist.items.${it.key}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <NeedHelpCTA compact />
      </CardContent>
    </Card>
  );
}
