import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, Download, Loader2, ShieldCheck } from "lucide-react";
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
import { generateBackup, listBackups } from "@/lib/backup.functions";

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

export function BackupPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBackups);
  const genFn = useServerFn(generateBackup);

  const list = useQuery({
    queryKey: ["admin-backups"],
    queryFn: () => listFn({}),
  });

  const gen = useMutation({
    mutationFn: () => genFn({}),
    onSuccess: (res) => {
      try {
        downloadBase64Gz(res.filename, res.base64);
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

  const last = list.data?.items?.[0];
  const lastMeta = (last?.metadata ?? {}) as {
    compressed_size_bytes?: number;
    total_rows?: number;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" /> Database Backups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 bg-muted/30">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div className="text-sm flex-1 min-w-[200px]">
            <div className="font-medium">Last backup</div>
            <div className="text-muted-foreground text-xs">
              {last
                ? `${new Date(last.created_at).toLocaleString()} • ${formatBytes(lastMeta.compressed_size_bytes)} • ${lastMeta.total_rows ?? "?"} rows`
                : "No backup generated yet"}
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            JSON · gzip
          </Badge>
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
                <TableHead>By</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data?.items ?? []).map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">
                    {new Date(b.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.performed_by_email ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatBytes(b.metadata?.compressed_size_bytes)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.metadata?.total_rows ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!list.isLoading && (list.data?.items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                    No backups yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Backups are super-admin only, generated server-side with elevated
          access, and logged in the audit log. Store downloaded files in a
          secure location (e.g. Google Drive shared folder). See{" "}
          <code>docs/RECOVERY.md</code> for restore steps.
        </p>
      </CardContent>
    </Card>
  );
}
