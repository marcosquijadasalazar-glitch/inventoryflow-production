import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Short identifier (route, component, widget) used in console logs. */
  name?: string;
  /** Custom fallback. If omitted, a compact card is rendered. */
  fallback?: ReactNode;
  /** Extra context (org id, user id, etc.) included in the console.error payload. */
  context?: Record<string, unknown>;
  /** Reset boundary when these values change (e.g. route key, language). */
  resetKeys?: ReadonlyArray<unknown>;
};

type State = { error: Error | null };

/**
 * Production-safe error boundary. Catches render-time crashes inside its
 * subtree so one failing widget cannot blank the entire app.
 *
 * Logs a structured payload to console.error (visible in Server Logs /
 * browser devtools) including the boundary name, route, and any extra
 * context the caller passes in.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const payload = {
      boundary: this.props.name ?? "anonymous",
      route: typeof window !== "undefined" ? window.location.pathname : "ssr",
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      ...(this.props.context ?? {}),
    };
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", payload);
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.state.error) return;
    const prev = prevProps.resetKeys ?? [];
    const next = this.props.resetKeys ?? [];
    if (prev.length !== next.length || prev.some((v, i) => v !== next[i])) {
      this.setState({ error: null });
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              This section couldn't load
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {this.state.error.message || "Unexpected error"}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
              component: {this.props.name ?? "anonymous"}
            </p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
