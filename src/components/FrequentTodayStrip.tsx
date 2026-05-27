import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

const HISTORY_KEY = "scanner-history-v1";

type HistoryEntry = {
  productName: string;
  barcode: string;
  mode: string;
  ts: number;
};

function load(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function FrequentTodayStrip({
  onPick,
}: {
  onPick: (barcode: string) => void;
}) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(load());
    refresh();
    window.addEventListener("scanner-history-changed", refresh);
    return () =>
      window.removeEventListener("scanner-history-changed", refresh);
  }, []);

  const items = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = entries.filter((e) => e.ts >= startOfDay.getTime());
    const counts = new Map<
      string,
      { barcode: string; name: string; count: number }
    >();
    for (const e of today) {
      if (!e.barcode) continue;
      const existing = counts.get(e.barcode);
      if (existing) existing.count += 1;
      else counts.set(e.barcode, { barcode: e.barcode, name: e.productName, count: 1 });
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [entries]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {t("scanner.frequentToday")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button
            key={it.barcode}
            type="button"
            onClick={() => onPick(it.barcode)}
            className="text-xs rounded-full bg-background border border-border hover:bg-muted/60 px-2.5 py-1 max-w-[180px] truncate inline-flex items-center gap-1.5"
            title={`${it.name} · ${it.barcode}`}
          >
            <span className="truncate">{it.name}</span>
            <span className="text-muted-foreground">×{it.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
