import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Warehouse } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/locations-tabs/OverviewTab";
import { LocationStockPanel } from "@/components/locations-tabs/StockTab";
import { HierarchyTab } from "@/components/locations-tabs/HierarchyTab";
import { ActivityTab } from "@/components/locations-tabs/ActivityTab";

export const Route = createFileRoute("/_authenticated/locations")({
  component: LocationsHubPage,
});

function LocationsHubPage() {
  const navigate = useNavigate();
  const tab = useRouterState({
    select: (s) => ((s.location.search as any)?.tab as string) || "overview",
  });

  const setTab = (v: string) =>
    navigate({ to: "/locations", search: (prev: Record<string, any>) => ({ ...prev, tab: v }) });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Warehouse className="h-5 w-5" />
          Locations
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage warehouses, storage locations, and inventory visibility in one place.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stock">Stock by Location</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab onGoTo={setTab} />
        </TabsContent>
        <TabsContent value="stock" className="mt-0 -mx-6 -mb-6">
          <LocationStockPanel />
        </TabsContent>
        <TabsContent value="hierarchy" className="mt-0">
          <HierarchyTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <ActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
