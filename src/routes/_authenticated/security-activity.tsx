import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/lib/profile";
import { getPresenceSnapshot, getSecurityActivity, SECURITY_ACTIONS } from "@/lib/security.functions";

export const Route = createFileRoute("/_authenticated/security-activity")({
  component: SecurityActivityPage,
});

function ago(iso: string | null | undefined) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "Active now";
  if (ms < 3600000) return `Last active ${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `Last active ${Math.floor(ms / 3600000)}h ago`;
  return "Last active yesterday";
}

function SecurityActivityPage() {
  const profile = useProfile();
  const role = profile.data?.role;
  const canView = role === "owner" || role === "manager" || role === "super_admin";
  const fetchActivity = useServerFn(getSecurityActivity);
  const fetchPresence = useServerFn(getPresenceSnapshot);

  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("__all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const activity = useQuery({
    queryKey: ["security-activity", search, action, dateFrom, dateTo],
    queryFn: () =>
      fetchActivity({
        data: {
          search: search || null,
          action: action === "__all" ? null : (action as any),
          date_from: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString() : null,
          date_to: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : null,
          limit: 200,
        },
      }),
    enabled: canView,
  });

  const presence = useQuery({
    queryKey: ["security-presence"],
    queryFn: () => fetchPresence({}),
    enabled: canView,
    refetchInterval: 45000,
  });

  const onlineRows = useMemo(
    () =>
      ((presence.data?.rows ?? []) as any[]).filter((r) => {
        const ms = Date.now() - new Date(r.last_seen_at).getTime();
        return r.is_online && ms <= 120000;
      }),
    [presence.data?.rows],
  );

  if (!canView) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Security / Login Activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Operational visibility for sign-ins, security events, and active users.
          </p>
        </div>
        <Badge variant="secondary">{onlineRows.length} online now</Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currently Online</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Device</th>
                <th className="py-2 pr-4 font-medium">Browser</th>
                <th className="py-2 pr-4 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {onlineRows.map((r) => (
                <tr key={r.user_id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.full_name ?? r.email ?? "—"}</td>
                  <td className="py-2 pr-4">{r.role ?? "—"}</td>
                  <td className="py-2 pr-4">{r.device ?? "—"}</td>
                  <td className="py-2 pr-4">{r.browser ?? "—"}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{ago(r.last_seen_at)}</td>
                </tr>
              ))}
              {onlineRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No active users right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Login & Security Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="Search user, action, browser..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All actions</SelectItem>
                {SECURITY_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Device</th>
                  <th className="py-2 pr-4 font-medium">Browser</th>
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {((activity.data?.rows ?? []) as any[]).map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.email ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline">{r.action}</Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge>
                    </td>
                    <td className="py-2 pr-4">{r.device ?? "—"}</td>
                    <td className="py-2 pr-4">{r.browser ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.ip_address ?? "—"}</td>
                  </tr>
                ))}
                {!activity.isLoading && ((activity.data?.rows ?? []) as any[]).length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No activity found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

