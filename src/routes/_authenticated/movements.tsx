import { createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActivityTab } from "@/components/movements-tabs/ActivityTab";
import { AdjustmentsTab } from "@/components/movements-tabs/AdjustmentsTab";
import { TransfersTab } from "@/components/movements-tabs/TransfersTab";
import { InternalUseTab } from "@/components/movements-tabs/InternalUseTab";
import { MovementsHistoryStandard } from "@/components/movements-tabs/MovementsHistoryStandard";
import {
  ArrowLeftRight,
  Package,
  SlidersHorizontal,
  ArrowDownRight,
  ArrowUpRight,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/movements")({
  component: MovementsPage,
});

function MovementsPage() {
  const { t } = useTranslation();
  const routerState = useRouterState();
  const tab = (routerState.location.search as any)?.tab || "transfers";
  const navigate = useNavigate({ from: "/movements" });

  const tabs = [
    {
      key: "transfers",
      label: t("movements.tabTransfers", "Transfers"),
      icon: Package,
    },
    {
      key: "adjustments",
      label: t("movements.tabAdjustments", "Adjustments"),
      icon: SlidersHorizontal,
    },
    {
      key: "receiving",
      label: t("movements.tabReceiving", "Receiving"),
      icon: ArrowUpRight,
    },
    {
      key: "stock-out",
      label: t("movements.tabStockOut", "Stock Out"),
      icon: ArrowDownRight,
    },
    {
      key: "internal-use",
      label: t("movements.tabInternalUse", "Internal Use"),
      icon: Wrench,
    },
    {
      key: "activity",
      label: t("movements.tabAllActivity", "All Activity"),
      icon: ArrowLeftRight,
    },
  ];

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({
            to: "/movements",
            search: (prev: Record<string, any>) => ({ ...prev, tab: v }),
          })
        }
      >
        <TabsList className="bg-muted h-auto flex-wrap gap-1 p-1">
          {tabs.map((tabItem) => (
            <TabsTrigger
              key={tabItem.key}
              value={tabItem.key}
              className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <tabItem.icon className="h-3.5 w-3.5" />
              {tabItem.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="transfers" className="mt-4">
          <TransfersTab />
        </TabsContent>
        <TabsContent value="adjustments" className="mt-4">
          <AdjustmentsTab />
        </TabsContent>
        <TabsContent value="receiving" className="mt-4">
          <MovementsHistoryStandard module="receiving" />
        </TabsContent>
        <TabsContent value="stock-out" className="mt-4">
          <MovementsHistoryStandard module="stock-out" />
        </TabsContent>
        <TabsContent value="internal-use" className="mt-4">
          <InternalUseTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab mode="history-only" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
