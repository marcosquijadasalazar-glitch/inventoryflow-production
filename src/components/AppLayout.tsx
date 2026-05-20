import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ArrowLeftRight, AlertTriangle, Boxes } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/movements", label: "Movements", icon: ArrowLeftRight },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white text-black">
      <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-neutral-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-neutral-200">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Boxes className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">InventoryFlow</span>
        </div>
        <nav className="flex md:flex-col gap-1 p-3 overflow-x-auto">
          {nav.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-neutral-700 hover:bg-neutral-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 px-4 sm:px-8 py-6 sm:py-10 max-w-full overflow-x-hidden">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
