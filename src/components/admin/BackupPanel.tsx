import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  CalendarDays,
  Database,
  Download,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  generateBackup,
  getBackupDownloadUrl,
  listBackups,
} from "@/lib/backup.functions";

function formatBytes(n: number | null | undefined) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadBase64Gz(filename: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/gzip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    daily: "bg-primary/15 text-primary border-primary/30",
    monthly: "bg-accent/40 text-foreground border-accent",
    manual: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${map[type] ?? map.manual}`}>
      {type}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "failure")
    return (
      <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/30">
        Failed
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/30">
      Success
    </Badge>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  item,
}: {
  icon: typeof CalendarDays;
  label: string;
  item: any;
}) {
  return (
    <div className="rounded-md border p-3 bg-muted/30 flex items-start gap-3">
      <Icon className="h-4 w-4 text-primary mt-0.5" />
      <div className="text-sm flex-1 min-w-0">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground text-xs truncate">
          {item
            ? `${new Date(item.created_at).toLocaleString()} • ${formatBytes(item.size)}`
            : "Never"}
        </div>
      </div>
    </div>
  );
}

export function BackupPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBackups);
  const genFn = useServerFn(generateBackup);
  const urlFn = useServerFn(getBackupDownloadUrl);

  const list = useQuery({
    queryKey: ["admin-backups"],
    queryFn: () => listFn({}),
  });

  const gen = useMutation({
    mutationFn: () => genFn({}),
    onSuccess: (res) => {
      try {
        if (res.base64) downloadBase64Gz(res.filename, res.base64);
        toast.success(
          `Backup generated (${formatBytes(res.compressed_size_bytes)}, ${res.total_rows} rows)`,
        );
      } catch (e: any) {
        toast.error(e?.message ?? "Download failed");
      }
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Backup failed"),
  });

  const summary = list.data?.summary;
  const items = list.data?.items ?? [];

  const handleDownload = async (storage_path: string, filename: string) => {
    try {
      const { url } = await urlFn({ data: { storage_path } });
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" /> Database Backups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard icon={CalendarDays} label="Last daily" item={summary?.last_daily} />
          <SummaryCard icon={CalendarClock} label="Last monthly" item={summary?.last_monthly} />
          <SummaryCard icon={ShieldCheck} label="Last manual" item={summary?.last_manual} />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
          <div className="text-sm flex-1 min-w-[200px]">
            <div className="font-medium">Generate manual backup</div>
            <div className="text-muted-foreground text-xs">
              Uploads to private storage and downloads to your machine.
            </div>
          </div>
          <Badge variant="outline" className="text-xs">JSON · gzip</Badge>
          <Button
            size="sm"
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="gap-2"
          >
            {gen.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {gen.isPending ? "Generating…" : "Generate & download"}
          </Button>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">
                    {new Date(b.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell><TypeBadge type={b.type} /></TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="text-sm">{b.performed_by_email ?? "system"}</TableCell>
                  <TableCell className="text-sm">{formatBytes(b.size)}</TableCell>
                  <TableCell className="text-sm">{b.total_rows ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {b.storage_path && b.status === "success" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1"
                        onClick={() => handleDownload(b.storage_path!, b.filename ?? "backup.json.gz")}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    ) : b.status === "failure" ? (
                      <span className="text-xs text-destructive">{b.error ?? "Failed"}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!list.isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    No backups yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Scheduled daily (02:00 UTC) and monthly (1st @ 03:00 UTC) backups are
          uploaded to a private <code>backups</code> bucket. Daily backups are
          retained 30 days, monthly 12 months. Every run is logged in the audit
          log. See <code>docs/RECOVERY.md</code> for restore steps.
        </p>
      </CardContent>
    </Card>
  );
}
