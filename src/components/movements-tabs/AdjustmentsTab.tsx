import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdjustmentsImporter,
  RecentImportsCard,
  GuidanceCard,
} from "@/components/AdjustmentsImporter";
import { ActivityTab } from "@/components/movements-tabs/ActivityTab";
import { MovementsHistoryStandard } from "@/components/movements-tabs/MovementsHistoryStandard";

export function AdjustmentsTab() {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <SlidersHorizontal className="h-5 w-5" />
            {t("adjustments.title", "Inventory Adjustments")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {t(
              "adjustments.subtitle",
              "Update stock to match what's actually on your shelves. Record a single change, or upload a file for bulk updates.",
            )}
          </p>
        </div>
        <Link to="/scanner">
          <Button variant="outline" size="sm">
            <ScanLine className="mr-1.5 h-3.5 w-3.5" />
            {t("adjustments.openScanner", "Count with Scanner")}
          </Button>
        </Link>
      </div>

      {/* 1. Manual adjustment form */}
      <ActivityTab mode="form-only" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* 2. Bulk import */}
          <AdjustmentsImporter onImported={() => setRefreshKey((k) => k + 1)} />
          {/* 4. Recent imports */}
          <RecentImportsCard refreshKey={refreshKey} />
        </div>
        <div className="space-y-6">
          {/* 3. How adjustments work */}
          <GuidanceCard />
        </div>
      </div>

      {/* 5. Adjustment history (standardized) */}
      <MovementsHistoryStandard module="adjustments" />

    </div>
  );
}
