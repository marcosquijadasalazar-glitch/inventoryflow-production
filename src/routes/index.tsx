import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  ArrowRight,
  Check,
  Boxes,
  Package,
  ArrowLeftRight,
  AlertTriangle,
  LayoutDashboard,
  ScanLine,
  Receipt,
  TrendingUp,
  Building2,
  Truck,
  Store,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InventoryFlow — Smart inventory for modern small businesses" },
      {
        name: "description",
        content:
          "Manage inventory, stock movements, orders and barcode workflows in one simple platform built for warehouses and small businesses.",
      },
      { property: "og:title", content: "InventoryFlow — Smart inventory for modern small businesses" },
      {
        property: "og:description",
        content:
          "Manage inventory, stock movements, orders and barcode workflows in one simple platform.",
      },
    ],
  }),
  component: LandingRoute,
});

function LandingRoute() {
  return (
    <ErrorBoundary name="LandingPage" context={{ route: "/" }}>
      <LandingPage />
    </ErrorBoundary>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black antialiased">
      <SiteHeader />
      <Hero />
      <DashboardPreview />
      <Features />
      <HowItWorks />
      <WhoItsFor />
      <RequestAccess />
      <SiteFooter />
    </div>
  );
}

/* ---------- Header ---------- */

const NAV = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Who it's for", href: "#who" },
  { label: "Request Access", href: "#request" },
];

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
            <Boxes className="h-4.5 w-4.5 text-white" strokeWidth={2.25} />
          </div>
          <span className="font-semibold tracking-tight text-[15px]">InventoryFlow</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-black/70">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-black transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-9 text-black hover:bg-black/5">
            <Link to="/login">Login</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="h-9 bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-none"
          >
            <a href="#request">
              Request Access
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/70">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0066FF]" />
          Now in private beta
        </div>

        <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[64px] font-semibold tracking-[-0.025em] max-w-4xl mx-auto leading-[1.02] text-black">
          Smart inventory for{" "}
          <span className="text-[#0066FF]">modern small businesses.</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-black/60 max-w-2xl mx-auto leading-relaxed">
          InventoryFlow helps warehouses and small businesses manage inventory, stock movements,
          orders, barcode workflows, and operations in one simple platform.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 px-5 bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-none"
          >
            <a href="#request">
              Request Early Access
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 px-5 border-black/15 text-black hover:bg-black/5 bg-white"
          >
            <a href="#how">See how it works</a>
          </Button>
        </div>

        <p className="mt-5 text-xs text-black/50">
          No credit card required · Cancel anytime
        </p>
      </div>
    </section>
  );
}

/* ---------- Dashboard preview ---------- */

function DashboardPreview() {
  return (
    <section className="pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-black/[0.08] bg-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.18)] overflow-hidden">
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 h-9 border-b border-black/[0.06] bg-[#FAFAFA]">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
            </div>
            <div className="mx-auto text-[11px] text-black/50 font-mono">
              app.inventoryflow / dashboard
            </div>
          </div>

          <div className="grid grid-cols-12 min-h-[440px]">
            {/* Sidebar */}
            <div className="hidden md:flex col-span-2 flex-col gap-0.5 p-3 border-r border-black/[0.06] bg-white">
              {[
                { icon: LayoutDashboard, label: "Dashboard", active: true },
                { icon: Package, label: "Products" },
                { icon: ArrowLeftRight, label: "Movements" },
                { icon: Receipt, label: "Orders" },
                { icon: ScanLine, label: "Scanner" },
                { icon: AlertTriangle, label: "Alerts" },
              ].map((i) => (
                <div
                  key={i.label}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${
                    i.active
                      ? "bg-[#0066FF]/8 text-[#0066FF] font-medium"
                      : "text-black/60"
                  }`}
                >
                  <i.icon className="h-3.5 w-3.5" />
                  {i.label}
                </div>
              ))}
            </div>

            {/* Main */}
            <div className="col-span-12 md:col-span-10 p-5 space-y-4 bg-[#FAFAFA]/60">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Total SKUs", value: "1,284", trend: "+3.2%" },
                  { label: "Stock value", value: "$842k", trend: "+5.4%" },
                  { label: "Low stock", value: "27", trend: "-12%" },
                  { label: "Movements / 24h", value: "318", trend: "+8.1%" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-black/[0.06] bg-white p-3.5"
                  >
                    <span className="text-[11px] uppercase tracking-wider text-black/50">
                      {s.label}
                    </span>
                    <div className="mt-1.5 text-xl font-semibold tracking-tight text-black">
                      {s.value}
                    </div>
                    <div className="text-[11px] text-[#0066FF] font-medium">{s.trend}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 rounded-xl border border-black/[0.06] bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-black">Recent movements</span>
                    <span className="text-[11px] text-black/50">Last 24 hours</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { sku: "BRK-204", name: "Brake pad set", qty: "+120", in: true },
                      { sku: "OIL-005", name: "Synthetic oil 5W-30", qty: "-48", in: false },
                      { sku: "FLT-118", name: "Cabin air filter", qty: "+60", in: true },
                      { sku: "BAT-AGM", name: "AGM battery 70Ah", qty: "-12", in: false },
                    ].map((r) => (
                      <div
                        key={r.sku}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-black/[0.05] last:border-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-black/50">{r.sku}</span>
                          <span className="text-black/80">{r.name}</span>
                        </div>
                        <span
                          className={
                            r.in
                              ? "text-[#0066FF] font-medium"
                              : "text-black/70 font-medium"
                          }
                        >
                          {r.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-black/[0.06] bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-black">Stock health</span>
                    <TrendingUp className="h-3.5 w-3.5 text-black/40" />
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "In stock", pct: 78, color: "bg-[#0066FF]" },
                      { label: "Low stock", pct: 16, color: "bg-black/40" },
                      { label: "Out of stock", pct: 6, color: "bg-black/15" },
                    ].map((b) => (
                      <div key={b.label}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-black/60">{b.label}</span>
                          <span className="font-medium text-black">{b.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                          <div className={`h-full ${b.color}`} style={{ width: `${b.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Features ---------- */

function Features() {
  const features = [
    {
      icon: Package,
      title: "Products & catalog",
      desc: "One clean catalog with SKUs, barcodes, categories, suppliers, locations and live stock.",
    },
    {
      icon: ArrowLeftRight,
      title: "Stock movements",
      desc: "Add, remove and adjust stock with a full audit trail — every change attributed and timestamped.",
    },
    {
      icon: Receipt,
      title: "Sales & purchase orders",
      desc: "Issue orders, track fulfillment, and automatically reduce inventory when sales are confirmed.",
    },
    {
      icon: ScanLine,
      title: "Barcode workflows",
      desc: "Scan in, scan out, and manage stock from any phone — no scanner hardware required.",
    },
    {
      icon: AlertTriangle,
      title: "Low-stock alerts",
      desc: "Smart thresholds notify your team before something runs out, not after.",
    },
    {
      icon: TrendingUp,
      title: "Reports & insights",
      desc: "Sales, inventory, movements and operations reports — exportable to CSV and PDF.",
    },
  ];

  return (
    <section id="features" className="border-t border-black/[0.06] bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
            Features
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            Everything you need to run your operations.
          </h2>
          <p className="mt-3 text-black/60">
            A focused set of tools designed for the day-to-day reality of small businesses and
            warehouses.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-black/[0.06] rounded-2xl overflow-hidden border border-black/[0.06]">
          {features.map((f) => (
            <div key={f.title} className="bg-white p-7">
              <div className="h-9 w-9 rounded-lg bg-[#0066FF]/8 flex items-center justify-center mb-5">
                <f.icon className="h-4.5 w-4.5 text-[#0066FF]" />
              </div>
              <h3 className="font-semibold tracking-tight text-black">{f.title}</h3>
              <p className="mt-1.5 text-sm text-black/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Import your catalog",
      desc: "Bring in your products with a CSV import or add them as you go. Categories, suppliers, locations — all included.",
    },
    {
      n: "02",
      title: "Track every movement",
      desc: "Add stock, remove stock, scan barcodes, fulfill orders. Inventory updates in real time across your team.",
    },
    {
      n: "03",
      title: "Stay ahead with insights",
      desc: "Get alerts before you run out, see what's moving, and export reports your accountant will actually like.",
    },
  ];
  return (
    <section id="how" className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
            How it works
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            From spreadsheets to running smoothly — in an afternoon.
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-black/[0.08] bg-white p-7"
            >
              <div className="text-sm font-mono text-[#0066FF]">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-black">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-black/60 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Who it's for ---------- */

function WhoItsFor() {
  const audiences = [
    {
      icon: Building2,
      title: "Warehouses",
      desc: "Real-time stock across locations, with barcode-driven receiving and picking.",
    },
    {
      icon: Store,
      title: "Retail & e-commerce",
      desc: "Keep online and in-store inventory in sync. Reduce overselling and stockouts.",
    },
    {
      icon: Truck,
      title: "Distributors",
      desc: "Manage purchase and sales orders end-to-end with full visibility.",
    },
    {
      icon: Wrench,
      title: "Workshops & service",
      desc: "Track parts, internal usage and reorder points without the spreadsheet pain.",
    },
  ];
  return (
    <section id="who" className="border-t border-black/[0.06] bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
            Who it's for
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            Built for small teams that move fast.
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {audiences.map((a) => (
            <div
              key={a.title}
              className="rounded-2xl border border-black/[0.08] bg-white p-6"
            >
              <a.icon className="h-5 w-5 text-[#0066FF]" />
              <h3 className="mt-4 font-semibold tracking-tight text-black">{a.title}</h3>
              <p className="mt-1.5 text-sm text-black/60 leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Request access ---------- */

function RequestAccess() {
  const bullets = [
    "Priority onboarding",
    "Direct line to the team",
    "Lock in launch pricing",
  ];
  return (
    <section id="request" className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="rounded-3xl bg-black text-white p-10 sm:p-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5C9BFF]">
              Early access
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              Ready to run your inventory like a modern team?
            </h2>
            <p className="mt-3 text-white/70 max-w-md">
              Join the InventoryFlow early access program and get set up in minutes.
            </p>
            <ul className="mt-6 space-y-2.5">
              {bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-white/85">
                  <Check className="h-4 w-4 text-[#5C9BFF]" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-stretch">
            <Button
              asChild
              size="lg"
              className="h-12 px-6 bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-none text-base"
            >
              <Link to="/signup">
                Request Early Access
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 px-6 bg-transparent border-white/25 text-white hover:bg-white/10 text-base"
            >
              <a href="#how">See how it works</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function SiteFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-black flex items-center justify-center">
            <Boxes className="h-4 w-4 text-white" strokeWidth={2.25} />
          </div>
          <span className="text-sm font-medium text-black">InventoryFlow</span>
          <span className="text-xs text-black/40 ml-2">
            © {new Date().getFullYear()}
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs text-black/60">
          <Link to="/privacy" className="hover:text-black transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-black transition-colors">
            Terms
          </Link>
          <Link to="/service-agreement" className="hover:text-black transition-colors">
            Service Agreement
          </Link>
          <Link to="/login" className="hover:text-black transition-colors">
            Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
