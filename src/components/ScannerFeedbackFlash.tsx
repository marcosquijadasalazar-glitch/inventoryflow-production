import { useEffect, useState } from "react";
import { Check, AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type FlashKind = "success" | "duplicate" | "error";

export type FlashState = {
  kind: FlashKind;
  title: string;
  detail?: string;
  /** Bumped per call so identical messages still re-trigger the animation. */
  nonce: number;
} | null;

/**
 * Large mobile-friendly visual feedback shown after each scan.
 * Auto-dismisses after ~1.4s. Designed to be glanceable in low light.
 */
export function ScannerFeedbackFlash({ state }: { state: FlashState }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!state) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1400);
    return () => clearTimeout(t);
  }, [state?.nonce]);

  if (!state) return null;

  const Icon =
    state.kind === "success" ? Check : state.kind === "duplicate" ? RotateCcw : AlertTriangle;

  const tone =
    state.kind === "success"
      ? "border-success/40 bg-success/10 text-success"
      : state.kind === "duplicate"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-destructive/40 bg-destructive/10 text-destructive";

  return (
    <div
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 sm:p-4 transition-all duration-200",
        tone,
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none",
      )}
    >
      <div
        className={cn(
          "h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center shrink-0 bg-background/60",
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-base leading-tight truncate text-foreground">
          {state.title}
        </div>
        {state.detail && (
          <div className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
            {state.detail}
          </div>
        )}
      </div>
    </div>
  );
}
