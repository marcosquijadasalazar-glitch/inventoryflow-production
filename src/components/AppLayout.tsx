import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  AlertTriangle,
  Boxes,
  Menu,
  X,
  LogOut,
  History,
  ScanLine,
  Settings as SettingsIcon,
  Shield,
  ShoppingCart,
  Receipt,
  ArrowRightLeft,
  Wrench,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ScanBarcodeButton } from "./ScanBarcodeButton";
import { useProfile } from "@/lib/profile";

function useNavItems() {
  const { t } = useTranslation();
  const profile = useProfile();
  const items = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/products", label: t("nav.products"), icon: Package },
    { to: "/movements", label: t("nav.movements"), icon: ArrowLeftRight },
    { to: "/purchase-orders", label: t("nav.purchaseOrders", "Purchase Orders"), icon: ShoppingCart },
    { to: "/sales-orders", label: t("nav.salesOrders", "Sales Orders"), icon: Receipt },
    { to: "/transfer-orders", label: t("nav.transferOrders", "Transfers"), icon: ArrowRightLeft },
    { to: "/internal-use", label: t("nav.internalUse", "Internal Use"), icon: Wrench },
    { to: "/history", label: t("nav.history"), icon: History },
    { to: "/scanner", label: t("nav.scanner"), icon: ScanLine },
    { to: "/alerts", label: t("nav.alerts"), icon: AlertTriangle },
    { to: "/settings", label: t("nav.settings"), icon: SettingsIcon },
  ];
  if (profile.data?.role === "super_admin") {
    items.push({ to: "/admin", label: "Admin", icon: Shield });
  }
  return items;
}

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
  const { t } = useTranslation();
  const nav = useNavItems();
  const isActive = (to: string) => path === to || path.startsWith(to + "/");

  const handleSignOut = async () => {
    await signOut();
    toast.success(t("nav.signOut"));
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
          <div className="pt-1">
            <LanguageSwitcher compact />
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
            <div className="p-3 border-t border-sidebar-border">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setMobileOpen(false);
                  handleSignOut();
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
              {user?.email && (
                <p className="text-[11px] text-muted-foreground mt-2 truncate text-center">
                  {user.email}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop top bar */}
        <header className="hidden md:flex sticky top-0 z-30 h-14 items-center justify-between px-8 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <ScanBarcodeButton />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <LanguageSwitcher compact />
            <span className="hidden lg:inline truncate max-w-[200px]">{user?.email}</span>
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
              {initials}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleSignOut}
              aria-label={t("nav.signOut")}
              title={t("nav.signOut")}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
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
