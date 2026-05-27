import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Wifi, WifiOff, Loader2, CloudUpload } from "lucide-react";
import {
  subscribe,
  pendingCount,
  isOnline,
  isSyncing,
  flushQueue,
} from "@/lib/scan-queue";
import { cn } from "@/lib/utils";

export function ScannerStatusPill() {
  const { t } = useTranslation();
  const [, force] = useState(0);

  useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const online = isOnline();
  const syncing = isSyncing();
  const pending = pendingCount();

  let label = t("scanner.status.online");
  let Icon = Wifi;
  let cls = "border-success/25 bg-success/10 text-[oklch(0.4_0.12_155)]";

  if (!online) {
    label = t("scanner.status.offline");
    Icon = WifiOff;
    cls = "border-warning/30 bg-warning/10 text-[oklch(0.45_0.12_70)]";
  } else if (syncing) {
    label = t("scanner.status.syncing");
    Icon = Loader2;
    cls = "border-primary/30 bg-primary/10 text-primary";
  } else if (pending > 0) {
    label = t("scanner.status.pending", { count: pending });
    Icon = CloudUpload;
    cls = "border-primary/30 bg-primary/10 text-primary";
  }

  return (
    <button
      type="button"
      onClick={() => online && pending > 0 && flushQueue()}
      disabled={!online || pending === 0 || syncing}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 font-medium transition-colors",
        cls,
        online && pending > 0 && !syncing
          ? "hover:opacity-80 cursor-pointer"
          : "cursor-default",
      )}
      title={label}
    >
      <Icon className={cn("h-3 w-3", syncing && "animate-spin")} />
      {label}
    </button>
  );
}
