import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  History as HistoryIcon,
  Search,
  Package,
  ScanLine,
  ArrowLeftRight,
  MapPin,
  Boxes,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listOperationalFeed,
  type FeedItem,
} from "@/lib/operational-feed.functions";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

const TABS: Array<{ id: "all" | FeedItem["category"]; label: string; icon: any }> = [
  { id: "all", label: "All activity", icon: Sparkles },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "scanner", label: "Scanner", icon: ScanLine },
  { id: "transfers", label: "Transfers", icon: ArrowLeftRight },
  { id: "products", label: "Products", icon: Package },
  { id: "locations", label: "Locations", icon: MapPin },
];

const ICONS: Record<FeedItem["category"], any> = {
  inventory: Boxes,
  scanner: ScanLine,
  transfers: ArrowLeftRight,
  products: Package,
  locations: MapPin,
  other: Sparkles,
};

const TONES: Record<FeedItem["category"], string> = {
  inventory: "bg-success/10 text-success",
  scanner: "bg-primary/10 text-primary",
  transfers: "bg-blue-500/10 text-blue-500",
  products: "bg-violet-500/10 text-violet-500",
  locations: "bg-amber-500/10 text-amber-500",
  other: "bg-muted text-muted-foreground",
};

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 45) return "just now";
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  if (d < 7 * 86400) return `${Math.round(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function dayBucket(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yest = new Date(today.getTime() - 86400_000);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDay.getTime() === today.getTime()) return "Today";
  if (dDay.getTime() === yest.getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function HistoryPage() {
  const { t } = useTranslation();
  const fetchFeed = useServerFn(listOperationalFeed);
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("all");
  const [q, setQ] = useState("");

  const feedQ = useInfiniteQuery({
    queryKey: ["op-feed", tab, q],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchFeed({
        data: {
          category: tab,
          search: q || null,
          before: pageParam ?? null,
          limit: 50,
        },
      }),
    getNextPageParam: (last) => last.next_cursor,
  });

  const items: FeedItem[] = useMemo(
    () => (feedQ.data?.pages ?? []).flatMap((p) => p.items),
    [feedQ.data],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    for (const it of items) {
      const k = dayBucket(it.created_at);
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="space-y-5 max-w-4xl mx-auto p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <HistoryIcon className="h-6 w-6 text-primary" />
          {t("history.title", "Activity")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("history.subtitleFeed", "A live feed of what's happening across your warehouses — counts, transfers, restocks and more.")}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("history.searchPlaceholder", "Search a product, person, or location…")}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              tab === id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {feedQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">{t("history.emptyTitle", "Nothing here yet")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("history.emptyBody", "Scan, receive, transfer or adjust stock and you'll see it appear here.")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, list]) => (
            <section key={day} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">{day}</h2>
              <ul className="space-y-1.5">
                {list.map((it) => {
                  const Icon = ICONS[it.category];
                  const tone = TONES[it.category];
                  return (
                    <li
                      key={it.id}
                      className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/30"
                    >
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{it.title}</p>
                        {it.subtitle && (
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">{it.subtitle}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {timeAgo(it.created_at)}
                          {it.actor ? ` · ${it.actor}` : ""}
                        </p>
                      </div>
                      {it.delta && (
                        <div className={cn(
                          "shrink-0 self-center rounded-md px-2 py-1 text-xs font-mono tabular-nums",
                          it.delta.startsWith("+") ? "bg-success/10 text-success"
                          : it.delta.startsWith("-") ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                        )}>
                          {it.delta}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {feedQ.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => feedQ.fetchNextPage()} disabled={feedQ.isFetchingNextPage}>
                {feedQ.isFetchingNextPage ? t("common.loading", "Loading…") : t("history.loadMore", "Load more")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
