import { useState } from "react";
import { Bell, CheckCheck, Inbox, AlertTriangle, CreditCard, Clock, UserPlus, ShieldCheck, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
  type NotificationType,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ICONS: Record<NotificationType, typeof Bell> = {
  low_stock: AlertTriangle,
  payment_failed: CreditCard,
  trial_ending: Clock,
  user_created: UserPlus,
  role_changed: ShieldCheck,
  system: Info,
};

const ICON_COLORS: Record<NotificationType, string> = {
  low_stock: "text-warning",
  payment_failed: "text-destructive",
  trial_ending: "text-warning",
  user_created: "text-primary",
  role_changed: "text-primary",
  system: "text-muted-foreground",
};

export function NotificationBell() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const fetchList = useServerFn(listNotifications);
  const fetchMarkRead = useServerFn(markNotificationRead);
  const fetchMarkAll = useServerFn(markAllNotificationsRead);

  const q = useQuery({
    queryKey: ["notifications", session?.user?.id],
    queryFn: () => fetchList({}),
    enabled: !!session,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => fetchMarkRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => fetchMarkAll({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const list = q.data?.notifications ?? [];
  const unread = q.data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[calc(100vw-2rem)] p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "You're all caught up"}
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {list.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-border">
              {list.map((n) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  onClick={() => {
                    if (!n.read) markOne.mutate(n.id);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10 gap-2">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No notifications</p>
      <p className="text-xs text-muted-foreground">
        New alerts about your inventory, billing, and team will appear here.
      </p>
    </div>
  );
}

function NotificationItem({ n, onClick }: { n: NotificationRow; onClick: () => void }) {
  const Icon = ICONS[n.type] ?? Bell;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/60 transition-colors",
          !n.read && "bg-primary/[0.04]",
        )}
      >
        <div
          className={cn(
            "h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0",
            ICON_COLORS[n.type],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-tight">{n.title}</p>
            {!n.read && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" aria-label="Unread" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
          <p className="text-[10px] text-muted-foreground/80 mt-1">{relTime(n.created_at)}</p>
        </div>
      </button>
    </li>
  );
}
