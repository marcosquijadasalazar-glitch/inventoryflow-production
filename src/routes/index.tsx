import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  ArrowRight,
  Activity,
  Sparkles,
  Shield,
  Package,
  AlertTriangle,
  ArrowLeftRight,
  LayoutDashboard,
  TrendingUp,
  Check,
  Zap,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InventoryFlow — Modern Warehouse Operations Software" },
      {
        name: "description",
        content:
          "Real-time inventory, intelligent low-stock alerts, and clean movement history. The warehouse OS built for teams that ship.",
      },
      { property: "og:title", content: "InventoryFlow — Warehouse OS" },
      {
        property: "og:description",
        content: "Real-time inventory, alerts, and movement history for modern warehouses.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <LogoStrip />
      <DashboardPreview />
      <Features />
      <Stats />
      <Pricing />
      <FinalCTA />
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] flex items-center justify-center shadow-soft">
            <Boxes className="h-5 w-5 text-primary-foreground" strokeWidth={2.25} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">InventoryFlow</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Warehouse OS
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#preview" className="hover:text-foreground transition-colors">Product</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link to="/login">Login</Link>
          </Button>
          <Button asChild size="sm" className="h-9 shadow-soft">
            <Link to="/signup">
              Start Free Trial
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="absolute inset-0 -z-10 opacity-60 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-20 right-0 h-72 w-72 rounded-full bg-[oklch(0.55_0.18_305)]/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 backdrop-blur px-3 py-1 text-xs text-muted-foreground shadow-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          New — intelligent stock alerts and saved views
        </div>
        <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight max-w-4xl mx-auto leading-[1.05]">
          Inventory that runs itself.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          InventoryFlow is the modern warehouse OS for real-time stock, intelligent alerts, and
          clean movement history — built for teams that ship.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 shadow-soft">
            <Link to="/signup">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11">
            <Link to="/login">Login</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Free 14-day trial · No credit card required
        </p>
      </div>
    </section>
  );
}

function LogoStrip() {
  const items = ["NorthPort Logistics", "Atlas Supply Co.", "Harbor & Crate", "Meridian Goods", "Forge Outfitters", "Brightline"];
  return (
    <section className="border-b border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
          Trusted by operations teams at fast-moving warehouses
        </p>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-center">
          {items.map((name) => (
            <div key={name} className="text-center text-sm font-medium text-muted-foreground/80 tracking-tight">
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <section id="preview" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">The product</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
            A dashboard built for warehouse operators
          </h2>
          <p className="mt-3 text-muted-foreground">
            See stock health, recent movements, and risk in one clean view.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 h-9 border-b border-border bg-muted/40">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.7_0.18_25)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.8_0.15_85)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.75_0.15_145)]" />
            </div>
            <div className="mx-auto text-[11px] text-muted-foreground font-mono">
              inventoryflow.app / dashboard
            </div>
          </div>

          <div className="grid grid-cols-12 min-h-[420px]">
            {/* Mini sidebar */}
            <div className="hidden md:flex col-span-2 flex-col gap-1 p-3 border-r border-border bg-sidebar/40">
              {[
                { icon: LayoutDashboard, label: "Dashboard", active: true },
                { icon: Package, label: "Products" },
                { icon: ArrowLeftRight, label: "Movements" },
                { icon: AlertTriangle, label: "Alerts" },
              ].map((i) => (
                <div
                  key={i.label}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
                    i.active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  <i.icon className="h-3.5 w-3.5" />
                  {i.label}
                </div>
              ))}
            </div>

            {/* Main */}
            <div className="col-span-12 md:col-span-10 p-5 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Total SKUs", value: "1,284", icon: Package, trend: "+3.2%" },
                  { label: "Stock value", value: "$842k", icon: TrendingUp, trend: "+5.4%" },
                  { label: "Low stock", value: "27", icon: AlertTriangle, trend: "-12%" },
                  { label: "Movements / 24h", value: "318", icon: ArrowLeftRight, trend: "+8.1%" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-background p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </span>
                      <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="mt-1.5 text-xl font-semibold tracking-tight">{s.value}</div>
                    <div className="text-[11px] text-success">{s.trend}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Recent movements</span>
                    <span className="text-[11px] text-muted-foreground">Last 24 hours</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { sku: "BRK-204", name: "Brake pad set", qty: "+120", in: true },
                      { sku: "OIL-005", name: "Synthetic oil 5W-30", qty: "-48", in: false },
                      { sku: "FLT-118", name: "Cabin air filter", qty: "+60", in: true },
                      { sku: "BAT-AGM", name: "AGM battery 70Ah", qty: "-12", in: false },
                    ].map((r) => (
                      <div key={r.sku} className="flex items-center justify-between text-xs py-1.5 border-b border-border/60 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-muted-foreground">{r.sku}</span>
                          <span>{r.name}</span>
                        </div>
                        <span className={r.in ? "text-success font-medium" : "text-destructive font-medium"}>
                          {r.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Stock health</span>
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "In stock", pct: 78, color: "bg-success" },
                      { label: "Low stock", pct: 16, color: "bg-warning" },
                      { label: "Out of stock", pct: 6, color: "bg-destructive" },
                    ].map((b) => (
                      <div key={b.label}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">{b.label}</span>
                          <span className="font-medium">{b.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
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

function Features() {
  const features = [
    {
      icon: Activity,
      title: "Live inventory health",
      desc: "Track stock status in real time with intelligent indicators for in-stock, low, and out-of-stock items.",
    },
    {
      icon: AlertTriangle,
      title: "Smart alerts",
      desc: "Automatic low-stock, out-of-stock, stale-item, and high-value risk alerts — before they hurt operations.",
    },
    {
      icon: ArrowLeftRight,
      title: "Frictionless movements",
      desc: "Add, remove, and adjust stock in seconds with a clean history trail and exportable logs.",
    },
    {
      icon: BarChart3,
      title: "Saved views & filters",
      desc: "Quickly slice your catalog by category, supplier, location, or stock status — and save your favorites.",
    },
    {
      icon: Zap,
      title: "Bulk operations",
      desc: "Update categories, locations, or pricing across hundreds of SKUs in one go. CSV export included.",
    },
    {
      icon: Shield,
      title: "Secure by default",
      desc: "Encrypted sessions, per-team access, and row-level security — your data, locked down.",
    },
  ];

  return (
    <section id="features" className="border-b border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Features</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
            Everything you need to run a warehouse
          </h2>
          <p className="mt-3 text-muted-foreground">
            Premium tools designed for daily warehouse operations — without the legacy bloat.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { value: "99.99%", label: "Uptime" },
    { value: "<120ms", label: "Median response" },
    { value: "1.2M+", label: "Movements tracked" },
    { value: "4.9/5", label: "Operator rating" },
  ];
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-3xl font-semibold tracking-tight">{s.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Starter",
      price: "$0",
      period: "forever",
      desc: "For small teams getting started.",
      features: ["Up to 250 SKUs", "1 location", "Basic alerts", "CSV export"],
      cta: "Start free",
      to: "/signup",
      highlight: false,
    },
    {
      name: "Growth",
      price: "$49",
      period: "/mo",
      desc: "For growing warehouse operations.",
      features: ["Unlimited SKUs", "5 locations", "Smart alerts", "Saved views", "Bulk operations"],
      cta: "Start free trial",
      to: "/signup",
      highlight: true,
    },
    {
      name: "Scale",
      price: "Custom",
      period: "",
      desc: "For multi-warehouse operations.",
      features: ["Unlimited locations", "SSO & SAML", "Audit logs", "Priority support", "Custom integrations"],
      cta: "Contact sales",
      to: "/signup",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="border-b border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
            Simple pricing that scales with you
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-2xl border bg-card p-6 shadow-soft flex flex-col ${
                t.highlight ? "border-primary/40 ring-1 ring-primary/30" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold tracking-tight">{t.name}</h3>
                {t.highlight && (
                  <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                    Popular
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">{t.price}</span>
                <span className="text-sm text-muted-foreground">{t.period}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
              <ul className="mt-5 space-y-2 text-sm flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={t.highlight ? "default" : "outline"}>
                <Link to={t.to}>{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[oklch(0.22_0.06_265)] via-[oklch(0.18_0.05_260)] to-[oklch(0.14_0.04_260)] p-10 sm:p-14 text-white">
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <div className="absolute -top-20 -left-10 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[oklch(0.55_0.18_305)]/30 blur-3xl" />
          </div>
          <div className="relative max-w-2xl">
            <Sparkles className="h-6 w-6 text-white/80" />
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
              Ship more, stress less.
            </h2>
            <p className="mt-3 text-white/70 max-w-lg">
              Start free, set up in minutes, and run your warehouse with the calm of a modern SaaS.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 bg-white text-foreground hover:bg-white/90">
                <Link to="/signup">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link to="/login">Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] flex items-center justify-center shadow-soft">
            <Boxes className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} InventoryFlow. All rights reserved.
          </span>
        </div>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <Link to="/login" className="hover:text-foreground">Login</Link>
        </div>
      </div>
    </footer>
  );
}
