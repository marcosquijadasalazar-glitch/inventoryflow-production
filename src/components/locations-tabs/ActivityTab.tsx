import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { listOperationalFeed } from "@/lib/operational-feed.functions";

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityTab() {
  const fetchFeed = useServerFn(listOperationalFeed);
  // Pull both locations + inventory + transfers (all location-related ops)
  const q = useQuery({
    queryKey: ["locations-activity"],
    queryFn: async () => {
      const [loc, inv, tr] = await Promise.all([
        fetchFeed({ data: { category: "locations", limit: 30 } }),
        fetchFeed({ data: { category: "inventory", limit: 30 } }),
        fetchFeed({ data: { category: "transfers", limit: 30 } }),
      ]);
      const items = [...loc.items, ...inv.items, ...tr.items]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 50);
      return { items };
    },
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const items = q.data?.items ?? [];
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No recent location activity yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border">
        {items.map((it) => (
          <div key={it.id} className="p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{it.title}</div>
              {it.subtitle && <div className="text-xs text-muted-foreground truncate">{it.subtitle}</div>}
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {timeAgo(it.created_at)}{it.actor ? ` · ${it.actor}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {it.delta && <Badge variant="outline" className="text-xs">{it.delta}</Badge>}
              <Badge variant="secondary" className="text-xs capitalize">{it.category}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
