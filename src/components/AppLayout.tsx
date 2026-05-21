import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  AlertTriangle,
  Boxes,
  Menu,
  X,
  Search,
  LogOut,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/movements", label: "Movements", icon: ArrowLeftRight },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
];

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  to: string;
  label: string;
  icon: typeof Boxes;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-soft"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 transition-colors",
          active ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
        )}
      />
      <span>{label}</span>
    </Link>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] flex items-center justify-center shadow-soft">
        <Boxes className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.25} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-semibold tracking-tight text-[15px]">InventoryFlow</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Warehouse OS
        </span>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/login", replace: true });
  };

  const initials = (user?.email ?? "??").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Brand />
        </div>
        <nav className="flex-1 flex flex-col gap-0.5 p-3">
          {nav.map((n) => (
            <NavItem key={n.to} {...n} active={isActive(n.to)} />
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-sidebar-accent/60 px-2.5 py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] text-primary-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{user?.email ?? "Signed in"}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Active session
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-md">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
              <Brand />
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 flex flex-col gap-0.5 p-3">
              {nav.map((n) => (
                <NavItem
                  key={n.to}
                  {...n}
                  active={isActive(n.to)}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop top bar */}
        <header className="hidden md:flex sticky top-0 z-30 h-14 items-center justify-between px-8 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>Search products, SKUs, suppliers…</span>
            <kbd className="ml-2 hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden lg:inline">Warehouse · Main</span>
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
              IF
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-10 pt-20 md:pt-10 max-w-full overflow-x-hidden animate-fade-in">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
