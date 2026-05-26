import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  ArrowRight,
  Check,
  X,
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
  Star,
  MessageCircle,
  Smartphone,
  MapPin,
  Globe,
  ShieldCheck,
  Cloud,
  Play,
  Mail,
  Phone,
  ChevronDown,
  Sparkles,
  Quote,
} from "lucide-react";

// Contact / WhatsApp configuration
const WHATSAPP_NUMBER = "16159180792";
const WHATSAPP_MESSAGE = `Hola 👋 / Hi 👋

Quiero información sobre InventoryFlow y cómo puede ayudar a mi negocio.

I would like information about InventoryFlow and how it can help my business.`;
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
const SUPPORT_EMAIL = "support@inventoryflowapp.com";
const SALES_EMAIL = "sales@inventoryflowapp.com";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title:
          "InventoryFlow — Inventory Management Software for Small Businesses & Warehouses",
      },
      {
        name: "description",
        content:
          "Modern bilingual inventory management software. Track products, stock movements, barcodes and multi-location operations in real time. Free 7-day trial — no credit card required.",
      },
      {
        name: "keywords",
        content:
          "inventory management software, inventory app, barcode inventory system, warehouse inventory software, inventory management for small business, bilingual inventory software, stock control, multi-location inventory",
      },
      {
        property: "og:title",
        content: "InventoryFlow — Smart inventory for growing businesses",
      },
      {
        property: "og:description",
        content:
          "Stop losing inventory. Control products, stock, orders and barcodes from one bilingual platform. Free 7-day trial.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://inventoryflowapp.com/" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "InventoryFlow — Smart inventory for growing businesses",
      },
      {
        name: "twitter:description",
        content:
          "Modern bilingual inventory management. Products, stock, barcodes and reports — free 7-day trial.",
      },
    ],
    links: [{ rel: "canonical", href: "https://inventoryflowapp.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "InventoryFlow",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          description:
            "Bilingual inventory management software for small businesses, warehouses and distributors.",
          offers: {
            "@type": "Offer",
            price: "29",
            priceCurrency: "USD",
          },
        }),
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
      <ProblemSolution />
      <Features />
      <ScreenshotsGallery />
      <DemoVideo />
      <HowItWorks />
      <WhoItsFor />
      <Testimonials />
      <BuiltForGrowth />
      <Pricing />
      <CompareTable />
      <LatamPositioning />
      <WhatsAppCTA />
      <FAQ />
      <FinalCTA />
      <SiteFooter />
      <FloatingWhatsApp />
    </div>
  );
}

/* ---------- Header ---------- */

function SiteHeader() {
  const { t } = useTranslation();
  const nav = [
    { label: t("landing.nav.features"), href: "#features" },
    { label: t("landing.nav.pricing"), href: "#pricing" },
    { label: t("landing.nav.how"), href: "#how" },
    { label: t("landing.footer.faq"), href: "#faq" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
            <Boxes className="h-4 w-4 text-white" strokeWidth={2.25} />
          </div>
          <span className="font-semibold tracking-tight text-[15px]">InventoryFlow</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-black/70">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-black transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          <Button asChild variant="ghost" size="sm" className="h-9 text-black hover:bg-black/5">
            <Link to="/login">{t("landing.nav.login")}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="h-9 bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-none"
          >
            <Link to="/signup">
              {t("landing.nav.startTrial")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  const { t } = useTranslation();
  const badges = [
    { icon: Smartphone, label: t("landing.hero.badges.mobile") },
    { icon: MapPin, label: t("landing.hero.badges.multilocation") },
    { icon: Globe, label: t("landing.hero.badges.bilingual") },
    { icon: ShieldCheck, label: t("landing.hero.badges.secure") },
    { icon: Cloud, label: t("landing.hero.badges.cloud") },
  ];
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 pt-20 pb-12 sm:pt-28 sm:pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/70">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0066FF]" />
          {t("landing.hero.badge")}
        </div>

        <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[64px] font-semibold tracking-[-0.025em] max-w-4xl mx-auto leading-[1.02] text-black">
          {t("landing.hero.titleA")}{" "}
          <span className="text-[#0066FF]">{t("landing.hero.titleB")}</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-black/60 max-w-2xl mx-auto leading-relaxed">
          {t("landing.hero.subtitle")}
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 px-5 bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-none"
          >
            <Link to="/signup">
              {t("landing.hero.ctaPrimary")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 px-5 border-black/15 text-black hover:bg-black/5 bg-white"
          >
            <a href="#demo">{t("landing.hero.ctaDemo")}</a>
          </Button>
          <Button
            asChild
            size="lg"
            className="h-11 px-5 bg-[#25D366] hover:bg-[#1FB855] text-white shadow-none"
          >
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              {t("landing.hero.ctaWhatsapp")}
            </a>
          </Button>
        </div>

        <p className="mt-5 text-xs text-black/50">{t("landing.hero.fineprint")}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {badges.map((b) => (
            <div
              key={b.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-black/70"
            >
              <b.icon className="h-3.5 w-3.5 text-[#0066FF]" />
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Dashboard preview ---------- */

function DashboardPreview() {
  const { t } = useTranslation();
  return (
    <section className="pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-black/[0.08] bg-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.18)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 h-9 border-b border-black/[0.06] bg-[#FAFAFA]">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
            </div>
            <div className="mx-auto text-[11px] text-black/50 font-mono">
              {t("landing.dashboardPreview.urlbar")}
            </div>
          </div>

          <div className="grid grid-cols-12 min-h-[440px]">
            <div className="hidden md:flex col-span-2 flex-col gap-0.5 p-3 border-r border-black/[0.06] bg-white">
              {[
                { icon: LayoutDashboard, label: t("landing.dashboardPreview.nav.dashboard"), active: true },
                { icon: Package, label: t("landing.dashboardPreview.nav.products") },
                { icon: ArrowLeftRight, label: t("landing.dashboardPreview.nav.movements") },
                { icon: Receipt, label: t("landing.dashboardPreview.nav.orders") },
                { icon: ScanLine, label: t("landing.dashboardPreview.nav.scanner") },
                { icon: AlertTriangle, label: t("landing.dashboardPreview.nav.alerts") },
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

            <div className="col-span-12 md:col-span-10 p-5 space-y-4 bg-[#FAFAFA]/60">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: t("landing.dashboardPreview.kpis.totalSkus"), value: "1,284", trend: "+3.2%" },
                  { label: t("landing.dashboardPreview.kpis.stockValue"), value: "$842k", trend: "+5.4%" },
                  { label: t("landing.dashboardPreview.kpis.lowStock"), value: "27", trend: "-12%" },
                  { label: t("landing.dashboardPreview.kpis.movements24"), value: "318", trend: "+8.1%" },
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
                    <span className="text-sm font-medium text-black">{t("landing.dashboardPreview.recent")}</span>
                    <span className="text-[11px] text-black/50">{t("landing.dashboardPreview.last24")}</span>
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
                          className={r.in ? "text-[#0066FF] font-medium" : "text-black/70 font-medium"}
                        >
                          {r.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-black/[0.06] bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-black">{t("landing.dashboardPreview.stockHealth")}</span>
                    <TrendingUp className="h-3.5 w-3.5 text-black/40" />
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: t("landing.dashboardPreview.inStock"), pct: 78, color: "bg-[#0066FF]" },
                      { label: t("landing.dashboardPreview.lowStockLabel"), pct: 16, color: "bg-black/40" },
                      { label: t("landing.dashboardPreview.outOfStock"), pct: 6, color: "bg-black/15" },
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

/* ---------- Problem / Solution ---------- */

function ProblemSolution() {
  const { t } = useTranslation();
  const problems = t("landing.problemSolution.problems", { returnObjects: true }) as string[];
  const solutions = t("landing.problemSolution.solutions", { returnObjects: true }) as string[];
  return (
    <section className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
              {t("landing.problemSolution.problemEyebrow")}
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
              {t("landing.problemSolution.problemTitle")}
            </h2>
            <ul className="mt-6 space-y-3">
              {problems.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 rounded-xl border border-black/[0.08] bg-[#FAFAFA] p-4"
                >
                  <X className="h-4 w-4 text-black/40 shrink-0 mt-0.5" />
                  <span className="text-sm text-black/80">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
              {t("landing.problemSolution.solutionEyebrow")}
            </p>
            <h3 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-black">
              {t("landing.problemSolution.solutionTitle")}
            </h3>
            <p className="mt-3 text-black/60">
              {t("landing.problemSolution.solutionSubtitle")}
            </p>
            <ul className="mt-6 space-y-2.5">
              {solutions.map((s) => (
                <li key={s} className="flex items-center gap-2.5 text-sm text-black/85">
                  <Check className="h-4 w-4 text-[#0066FF] shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
            <Button
              asChild
              size="lg"
              className="mt-6 h-11 px-5 bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-none"
            >
              <Link to="/signup">
                {t("landing.problemSolution.cta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Features ---------- */

function Features() {
  const { t } = useTranslation();
  const icons = [Package, ArrowLeftRight, Receipt, ScanLine, AlertTriangle, TrendingUp];
  const items = t("landing.features.items", { returnObjects: true }) as { title: string; desc: string }[];
  const features = items.map((it, i) => ({ ...it, icon: icons[i] }));

  return (
    <section id="features" className="border-t border-black/[0.06] bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">{t("landing.features.eyebrow")}</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.features.title")}
          </h2>
          <p className="mt-3 text-black/60">
            {t("landing.features.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-black/[0.06] rounded-2xl overflow-hidden border border-black/[0.06]">
          {features.map((f) => (
            <div key={f.title} className="bg-white p-7">
              <div className="h-9 w-9 rounded-lg bg-[#0066FF]/8 flex items-center justify-center mb-5">
                <f.icon className="h-4 w-4 text-[#0066FF]" />
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

/* ---------- Screenshots gallery ---------- */

function ScreenshotsGallery() {
  const { t } = useTranslation();
  const icons = [LayoutDashboard, Package, ScanLine, TrendingUp, ArrowLeftRight, ShieldCheck];
  const items = t("landing.screenshots.items", { returnObjects: true }) as { title: string; desc: string }[];
  const shots = items.map((it, i) => ({ ...it, icon: icons[i] }));
  return (
    <section className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
            {t("landing.screenshots.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.screenshots.title")}
          </h2>
          <p className="mt-3 text-black/60">
            {t("landing.screenshots.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shots.map((s) => (
            <figure
              key={s.title}
              className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden"
            >
              <div className="aspect-[16/10] bg-gradient-to-br from-[#F4F7FB] to-[#E9F0FA] border-b border-black/[0.06] flex flex-col items-center justify-center text-center p-6">
                <div className="h-12 w-12 rounded-xl bg-white border border-black/[0.06] flex items-center justify-center mb-3 shadow-sm">
                  <s.icon className="h-5 w-5 text-[#0066FF]" />
                </div>
                <div className="text-[11px] uppercase tracking-wider text-black/40">
                  {t("landing.screenshots.label")}
                </div>
                <div className="mt-1 text-sm font-medium text-black">{s.title}</div>
              </div>
              <figcaption className="p-4">
                <div className="text-sm font-medium text-black">{s.title}</div>
                <p className="mt-1 text-xs text-black/60 leading-relaxed">{s.desc}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Demo video ---------- */

function DemoVideo() {
  const { t } = useTranslation();
  return (
    <section id="demo" className="border-t border-black/[0.06] bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
            {t("landing.demoVideo.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.demoVideo.title")}
          </h2>
          <p className="mt-3 text-black/60">
            {t("landing.demoVideo.subtitle")}
          </p>
        </div>

        <div className="mt-10 relative rounded-2xl overflow-hidden border border-black/[0.08] bg-black aspect-video max-w-4xl mx-auto group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0066FF]/30 via-black to-black" />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              aria-label={t("landing.demoVideo.play")}
              className="h-20 w-20 rounded-full bg-white/95 flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110"
            >
              <Play className="h-8 w-8 text-[#0066FF] fill-[#0066FF] ml-1" />
            </button>
          </div>
          <div className="absolute bottom-4 left-4 text-white/80 text-xs font-medium">
            {t("landing.demoVideo.duration")}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 px-5 border-black/15 text-black hover:bg-black/5 bg-white"
          >
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              {t("landing.demoVideo.walkthrough")}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */

function HowItWorks() {
  const { t } = useTranslation();
  const stepItems = t("landing.howItWorks.steps", { returnObjects: true }) as { title: string; desc: string }[];
  const steps = stepItems.map((s, i) => ({ ...s, n: String(i + 1).padStart(2, "0") }));
  return (
    <section id="how" className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">{t("landing.howItWorks.eyebrow")}</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.howItWorks.title")}
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-black/[0.08] bg-white p-7">
              <div className="text-sm font-mono text-[#0066FF]">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-black">{s.title}</h3>
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
  const { t } = useTranslation();
  const icons = [Building2, Store, Truck, Wrench];
  const items = t("landing.whoItsFor.items", { returnObjects: true }) as { title: string; desc: string }[];
  const audiences = items.map((it, i) => ({ ...it, icon: icons[i] }));
  return (
    <section id="who" className="border-t border-black/[0.06] bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">{t("landing.whoItsFor.eyebrow")}</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.whoItsFor.title")}
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {audiences.map((a) => (
            <div key={a.title} className="rounded-2xl border border-black/[0.08] bg-white p-6">
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

/* ---------- Testimonials / Social proof ---------- */

function Testimonials() {
  const { t } = useTranslation();
  const items = t("landing.testimonials.items", { returnObjects: true }) as { quote: string; name: string; role: string }[];
  return (
    <section className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
            {t("landing.testimonials.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.testimonials.title")}
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((it) => (
            <figure
              key={it.name + it.role}
              className="rounded-2xl border border-black/[0.08] bg-white p-7 flex flex-col"
            >
              <Quote className="h-5 w-5 text-[#0066FF]" />
              <blockquote className="mt-4 text-sm text-black/85 leading-relaxed flex-1">
                "{it.quote}"
              </blockquote>
              <figcaption className="mt-5 pt-4 border-t border-black/[0.06]">
                <div className="text-sm font-medium text-black">{it.name}</div>
                <div className="text-xs text-black/55">{it.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-black/45">
          {t("landing.testimonials.note")}
        </p>
      </div>
    </section>
  );
}

/* ---------- Built for growth ---------- */

function BuiltForGrowth() {
  const { t } = useTranslation();
  const points = t("landing.recurring.points", { returnObjects: true }) as string[];
  return (
    <section className="border-t border-black/[0.06] bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
            {t("landing.recurring.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.recurring.title")}
          </h2>
          <p className="mt-3 text-black/60">{t("landing.recurring.subtitle")}</p>
        </div>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {points.map((p) => (
            <div
              key={p}
              className="flex items-start gap-3 rounded-2xl border border-black/[0.08] bg-white p-6"
            >
              <div className="h-8 w-8 rounded-lg bg-[#0066FF]/8 flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-[#0066FF]" />
              </div>
              <p className="text-sm font-medium text-black leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Pricing ---------- */

type PlanKey = "trial" | "starter" | "pro" | "enterprise";

function Pricing() {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const plans: {
    key: PlanKey;
    popular?: boolean;
    ctaLabel: string;
    ctaVariant: "primary" | "secondary" | "outline";
    to: string;
    plan?: "free" | "starter" | "pro";
  }[] = [
    { key: "trial", ctaLabel: t("landing.pricing.startTrial"), ctaVariant: "outline", to: "/signup", plan: "free" },
    { key: "starter", ctaLabel: t("landing.pricing.startStarter", "Get Started"), ctaVariant: "outline", to: "/signup", plan: "starter" },
    { key: "pro", popular: true, ctaLabel: t("landing.pricing.upgradeToPro"), ctaVariant: "primary", to: "/signup", plan: "pro" },
    { key: "enterprise", ctaLabel: t("landing.pricing.contactSales"), ctaVariant: "secondary", to: `mailto:${SALES_EMAIL}?subject=InventoryFlow%20Enterprise%20Inquiry` },
  ];

  const limits: Record<PlanKey, { users: string; products: string; locations: string }> = {
    trial: { users: "2", products: "100", locations: "1" },
    starter: { users: "3", products: "500", locations: "2" },
    pro: { users: "25", products: "∞", locations: "10" },
    enterprise: { users: "∞", products: "∞", locations: "∞" },
  };

  return (
    <section id="pricing" className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
            {t("landing.pricing.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.pricing.title")}
          </h2>
          <p className="mt-3 text-black/60">{t("landing.pricing.subtitle")}</p>
        </div>

        {/* Billing toggle (placeholder — yearly pricing coming soon) */}
        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-black/10 bg-white p-1">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
              billing === "monthly" ? "bg-black text-white" : "text-black/60 hover:text-black"
            }`}
          >
            {t("landing.pricingExtra.billingMonthly")}
          </button>
          <button
            type="button"
            onClick={() => setBilling("yearly")}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors inline-flex items-center gap-1.5 ${
              billing === "yearly" ? "bg-black text-white" : "text-black/60 hover:text-black"
            }`}
          >
            {t("landing.pricingExtra.billingYearly")}
            <span className="text-[10px] font-semibold text-[#0066FF] bg-[#0066FF]/10 px-1.5 py-0.5 rounded-full">
              {t("landing.pricingExtra.billingSave")}
            </span>
          </button>
        </div>
        {billing === "yearly" && (
          <p className="mt-2 text-xs text-black/50">
            {t("landing.pricingExtra.yearlyNote")}
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(({ key, popular, ctaLabel, ctaVariant, to, plan }) => {
            const features = t(`landing.pricing.plans.${key}.features`, { returnObjects: true }) as string[];
            const price = t(`landing.pricing.plans.${key}.price`);
            const setupFee = t(`landing.pricing.plans.${key}.setupFee`, { defaultValue: "" });
            const isCustom = key === "enterprise";
            const isTrial = key === "trial";
            const planLimits = limits[key];

            return (
              <div
                key={key}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 ${
                  popular
                    ? "border-[#0066FF] shadow-[0_24px_60px_-30px_rgba(0,102,255,0.45)]"
                    : "border-black/[0.08]"
                }`}
              >
                {popular && (
                  <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-[#0066FF] px-2.5 py-1 text-[11px] font-medium text-white">
                    <Star className="h-3 w-3" /> {t("landing.pricing.mostPopular")}
                  </div>
                )}
                {isTrial && (
                  <div className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] font-medium text-white">
                    {t("landing.pricing.freeTrialBanner")}
                  </div>
                )}

                <div className="text-sm font-medium text-black">{t(`landing.pricing.plans.${key}.name`)}</div>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-black">{price}</span>
                  {!isCustom && !isTrial && (
                    <span className="text-sm text-black/50">{t("landing.pricing.perMonth")}</span>
                  )}
                  {isTrial && (
                    <span className="text-sm text-black/50">· {t("landing.pricing.plans.trial.period")}</span>
                  )}
                </div>

                {!isTrial && !isCustom && setupFee && (
                  <p className="mt-1 text-xs text-black/50">
                    {t("landing.pricing.setupFee")}: {setupFee}
                  </p>
                )}

                <p className="mt-2 text-sm text-black/60 min-h-[40px]">
                  {t(`landing.pricing.plans.${key}.tagline`)}
                </p>

                {/* Plan limits */}
                <div className="mt-4 rounded-lg bg-black/[0.03] p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-black/50 mb-2">
                    {t("landing.pricing.limitsLabel")}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs font-semibold text-black">{planLimits.users}</div>
                      <div className="text-[10px] text-black/50">{t("landing.pricing.usersLabel")}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-black">{planLimits.products}</div>
                      <div className="text-[10px] text-black/50">{t("landing.pricing.productsLabel")}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-black">{planLimits.locations}</div>
                      <div className="text-[10px] text-black/50">{t("landing.pricing.locationsLabel")}</div>
                    </div>
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-black/80">
                      <Check className="h-4 w-4 text-[#0066FF] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-4">
                  <Button
                    asChild
                    className={`w-full h-10 shadow-none ${
                      ctaVariant === "primary"
                        ? "bg-[#0066FF] hover:bg-[#0052CC] text-white"
                        : ctaVariant === "outline"
                          ? "bg-white border border-black/15 text-black hover:bg-black/5"
                          : "bg-black hover:bg-black/85 text-white"
                    }`}
                  >
                    {key === "enterprise" ? (
                      <a href={to}>{ctaLabel}</a>
                    ) : plan ? (
                      <Link to="/signup" search={{ plan }}>{ctaLabel}</Link>
                    ) : (
                      <Link to="/signup">{ctaLabel}</Link>
                    )}
                  </Button>
                  {isTrial && (
                    <p className="mt-2 text-center text-[11px] text-black/50">
                      {t("landing.pricing.noCardRequired", "No credit card required")}
                    </p>
                  )}
                  {(key === "starter" || key === "pro") && (
                    <div className="mt-2 space-y-0.5 text-center text-[11px] text-black/50">
                      <p>{t("landing.pricing.noTrialPaid", "No free trial • Instant activation after payment")}</p>
                      <p>{t("landing.pricing.setupFeeOnce", "Setup fee charged only once")}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-black/50">{t("landing.pricing.trialNote")}</p>
      </div>
    </section>
  );
}

/* ---------- Compare table ---------- */

type CompareRow = { label: string; trial: string; starter: string; pro: string; enterprise: string };

function CompareCell({ value }: { value: string }) {
  if (value === "yes") return <Check className="h-4 w-4 text-[#0066FF] mx-auto" />;
  if (value === "no") return <X className="h-4 w-4 text-black/25 mx-auto" />;
  return <span className="text-sm text-black/80">{value}</span>;
}

function CompareTable() {
  const { t } = useTranslation();
  const rows = t("landing.pricing.compare.rows", { returnObjects: true }) as CompareRow[];
  return (
    <section className="border-t border-black/[0.06] bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h3 className="text-xl sm:text-2xl font-semibold tracking-[-0.01em] text-black">
          {t("landing.pricing.compare.title")}
        </h3>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-black/[0.08] bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left">
                <th className="px-5 py-3.5 font-medium text-black/60">{t("landing.pricing.compare.feature")}</th>
                <th className="px-5 py-3.5 font-medium text-black/80 text-center">{t("landing.pricing.plans.trial.name")}</th>
                <th className="px-5 py-3.5 font-medium text-black/80 text-center">{t("landing.pricing.plans.starter.name")}</th>
                <th className="px-5 py-3.5 font-medium text-[#0066FF] text-center">{t("landing.pricing.plans.pro.name")}</th>
                <th className="px-5 py-3.5 font-medium text-black/80 text-center">{t("landing.pricing.plans.enterprise.name")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-5 py-3 text-black/80">{r.label}</td>
                  <td className="px-5 py-3 text-center"><CompareCell value={r.trial} /></td>
                  <td className="px-5 py-3 text-center"><CompareCell value={r.starter} /></td>
                  <td className="px-5 py-3 text-center bg-[#0066FF]/[0.03]"><CompareCell value={r.pro} /></td>
                  <td className="px-5 py-3 text-center"><CompareCell value={r.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ---------- LATAM positioning ---------- */

function LatamPositioning() {
  const { t } = useTranslation();
  const icons = [Globe, Smartphone, Sparkles, Cloud];
  const raw = t("landing.latam.items", { returnObjects: true }) as { title: string; desc: string }[];
  const items = raw.map((it, i) => ({ ...it, icon: icons[i] }));
  return (
    <section className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
            {t("landing.latam.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.latam.title")}
          </h2>
          <p className="mt-3 text-black/60">
            {t("landing.latam.subtitle")}
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it) => (
            <div key={it.title} className="rounded-2xl border border-black/[0.08] bg-[#FAFAFA] p-6">
              <div className="h-9 w-9 rounded-lg bg-white border border-black/[0.06] flex items-center justify-center">
                <it.icon className="h-4 w-4 text-[#0066FF]" />
              </div>
              <h3 className="mt-4 font-semibold tracking-tight text-black">{it.title}</h3>
              <p className="mt-1.5 text-sm text-black/60 leading-relaxed">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

function FAQ() {
  const { t } = useTranslation();
  const items = t("landing.faqSection.items", { returnObjects: true }) as { q: string; a: string }[];
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">{t("landing.faqSection.eyebrow")}</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
            {t("landing.faqSection.title")}
          </h2>
        </div>
        <div className="mt-10 space-y-2">
          {items.map((it, i) => {
            const open = openIndex === i;
            return (
              <div
                key={it.q}
                className="rounded-xl border border-black/[0.08] bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-black/[0.02] transition-colors"
                  aria-expanded={open}
                >
                  <span className="text-sm font-medium text-black">{it.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-black/50 transition-transform shrink-0 ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {open && (
                  <div className="px-5 pb-4 text-sm text-black/70 leading-relaxed">{it.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- WhatsApp CTA ---------- */

function WhatsAppCTA() {
  const { t } = useTranslation();
  return (
    <section id="whatsapp-cta" className="border-t border-black/[0.06] bg-[#f8faf8]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="rounded-3xl bg-white border border-black/[0.06] p-10 sm:p-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#25D366]/10 px-3 py-1 text-xs font-semibold text-[#1B8C4A] mb-4">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-black">
              {t("landing.whatsappCta.title", "Need a quick demo?")}
            </h2>
            <p className="mt-3 text-black/60 max-w-md leading-relaxed">
              {t("landing.whatsappCta.subtitle", "Chat directly with us on WhatsApp and learn how InventoryFlow can help your business.")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-black/50">
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" />
                {t("landing.whatsappCta.mobile", "Mobile friendly")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-4 w-4" />
                {t("landing.whatsappCta.bilingual", "EN / ES")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#25D366]" />
                {t("landing.whatsappCta.instant", "Instant reply")}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 px-6 bg-[#25D366] hover:bg-[#1FB855] text-white shadow-none text-base"
            >
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" />
                {t("landing.whatsappCta.chat", "Chat on WhatsApp")}
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 px-6 border-black/10 hover:bg-black/[0.03] text-black shadow-none text-base"
            >
              <a href={`mailto:${SALES_EMAIL}`}>
                <Mail className="h-4 w-4" />
                {t("landing.whatsappCta.book", "Book Demo")}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */

function FinalCTA() {
  const { t } = useTranslation();
  const bullets = t("landing.cta.bullets", { returnObjects: true }) as string[];
  return (
    <section id="request" className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="rounded-3xl bg-black text-white p-10 sm:p-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5C9BFF]">
              {t("landing.cta.eyebrow")}
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              {t("landing.cta.title")}
            </h2>
            <p className="mt-3 text-white/70 max-w-md">{t("landing.cta.subtitle")}</p>
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
                {t("landing.cta.primary")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="h-12 px-6 bg-[#25D366] hover:bg-[#1FB855] text-white shadow-none text-base"
            >
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                {t("landing.whatsappCta.chat", "Chat on WhatsApp")}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
                <Boxes className="h-4 w-4 text-white" strokeWidth={2.25} />
              </div>
              <span className="font-semibold tracking-tight text-black">InventoryFlow</span>
            </div>
            <p className="mt-3 text-xs text-black/55 leading-relaxed max-w-xs">
              {t("landing.footer.tagline")}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-black/50">
              {t("landing.footer.product")}
            </div>
            <ul className="mt-4 space-y-2 text-sm text-black/70">
              <li><a href="#features" className="hover:text-black">{t("landing.footer.features")}</a></li>
              <li><a href="#pricing" className="hover:text-black">{t("landing.footer.pricing")}</a></li>
              <li><a href="#demo" className="hover:text-black">{t("landing.footer.demo")}</a></li>
              <li><a href="#faq" className="hover:text-black">{t("landing.footer.faq")}</a></li>
              <li><Link to="/login" className="hover:text-black">{t("landing.footer.login")}</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-black/50">
              {t("landing.footer.contact")}
            </div>
            <ul className="mt-4 space-y-2 text-sm text-black/70">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-black"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                  WhatsApp
                </a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 hover:text-black">
                  <Mail className="h-3.5 w-3.5" />
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <a href={`mailto:${SALES_EMAIL}`} className="inline-flex items-center gap-2 hover:text-black">
                  <Phone className="h-3.5 w-3.5" />
                  {SALES_EMAIL}
                </a>
              </li>
              <li>
                <a
                  href="https://inventoryflowapp.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-black"
                >
                  inventoryflowapp.com
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-black/50">
              {t("landing.footer.legal")}
            </div>
            <ul className="mt-4 space-y-2 text-sm text-black/70">
              <li><Link to="/privacy" className="hover:text-black">{t("landing.footer.privacy")}</Link></li>
              <li><Link to="/terms" className="hover:text-black">{t("landing.footer.terms")}</Link></li>
              <li><Link to="/disclaimer" className="hover:text-black">{t("landing.footer.disclaimer")}</Link></li>
              <li><Link to="/service-agreement" className="hover:text-black">{t("landing.footer.serviceAgreement")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-black/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-black/50">
          <span>{t("landing.footer.copyright", { year: new Date().getFullYear() })}</span>
          <span>{t("landing.footer.builtFor")}</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Floating WhatsApp ---------- */

function FloatingWhatsApp() {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <div className="mb-1 rounded-2xl bg-white border border-black/[0.08] px-4 py-2.5 text-sm text-black shadow-[0_8px_24px_-6px_rgba(0,0,0,0.12)] animate-in fade-in slide-in-from-bottom-2 duration-200">
          {t("landing.floatingWhatsapp.tooltip")}
        </div>
      )}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("landing.floatingWhatsapp.aria")}
        className="group relative inline-flex items-center justify-center rounded-full bg-[#25D366] hover:bg-[#1FB855] text-white w-14 h-14 shadow-[0_12px_30px_-8px_rgba(37,211,102,0.55)] transition-all hover:scale-105 active:scale-95"
      >
        <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" />
        <MessageCircle className="h-6 w-6 relative z-10" />
      </a>
    </div>
  );
}
