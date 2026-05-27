import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/lib/auth";
import { logPublicSecurityEvent } from "@/lib/security.functions";
import {
  ArrowRight,
  Check,
  X,
  Boxes,
  Package,
  ArrowLeftRight,
  AlertTriangle,
  LayoutDashboard,
  Bell,
  TrendingUp,
  Star,
  Crown,
  Smartphone,
  BarChart3,
  Users,
  Sparkles,
  Cloud,
  Languages,
  Zap,
  Rocket,
  Calendar,
  Mail,
  MessageCircle,
  ChevronDown,
  HelpCircle,
  BookOpen,
  Settings,
} from "lucide-react";

const WHATSAPP_NUMBER = "16159180792";
const WHATSAPP_MESSAGE = `Hola 👋 / Hi 👋

Quiero información sobre InventoryFlow y cómo puede ayudar a mi negocio.

I would like information about InventoryFlow and how it can help my business.`;
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
const SUPPORT_EMAIL = "support@inventoryflowapp.com";
const BOOK_DEMO_URL = "https://calendly.com/inventoryflow/onboarding";

const BRAND = "#0066FF";
const BRAND_DARK = "#0052CC";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    checkout: search.checkout === "cancelled" ? "cancelled" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "InventoryFlow — Inventory & Operations Platform for Growing Businesses" },
      {
        name: "description",
        content:
          "All-in-one inventory and operations platform. Track stock, employees, products and multi-location operations in real time. 7-day free trial.",
      },
      { property: "og:title", content: "InventoryFlow — Inventory & Operations Platform" },
      {
        property: "og:description",
        content:
          "Stop losing money to disorganized inventory and manual operations. One bilingual platform for products, stock, employees and operations.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://inventoryflowapp.com/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://inventoryflowapp.com/" }],
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
  const { checkout } = Route.useSearch();
  const logPublicEvent = useServerFn(logPublicSecurityEvent);
  useEffect(() => {
    if (checkout !== "cancelled") return;
    void logPublicEvent({
      data: {
        action: "checkout_abandoned",
        status: "info",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
    }).catch(() => {});
  }, [checkout, logPublicEvent]);
  return (
    <div className="min-h-screen bg-[#F6F8FC] text-slate-900 antialiased">
      <SiteHeader />
      <main>
        <Hero />
        <ProblemSolution />
        <Features />
        <PricingAndWhy />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ---------- Header ---------- */

function SiteHeader() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
        setResourcesOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}
          >
            <BarChart3 className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold tracking-tight text-[17px] text-slate-900">
            InventoryFlow
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-slate-900 transition-colors">
            {t("landing.nav.features", "Features")}
          </a>
          <a href="#pricing" className="hover:text-slate-900 transition-colors">
            {t("landing.nav.pricing", "Pricing")}
          </a>
          <div className="relative" ref={resourcesRef}>
            <button
              onClick={() => setResourcesOpen((o) => !o)}
              className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
            >
              {t("landing.nav.resources", "Resources")}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {resourcesOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-1.5">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-50"
                >
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                  {t("landing.nav.helpCenter", "Help Center")}
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=Setup%20Guides`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-50"
                >
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  {t("landing.nav.setupGuides", "Setup Guides")}
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Mail className="h-4 w-4 text-slate-400" />
                  {t("landing.nav.contactSupport", "Contact Support")}
                </a>
              </div>
            )}
          </div>
          <a
            href={BOOK_DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 transition-colors"
          >
            {t("landing.nav.demo", "Demo")}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          {session ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-9 px-4 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Link to="/dashboard">{t("landing.nav.dashboard", "Dashboard")}</Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-9 px-4 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Link to="/login">{t("landing.nav.login", "Log In")}</Link>
            </Button>
          )}
          <Button
            asChild
            size="sm"
            className="h-9 px-4 text-white shadow-sm rounded-lg"
            style={{ backgroundColor: BRAND }}
          >
            <Link to="/checkout" search={{ plan: "starter" }}>
              {t("landing.nav.startTrial", "Start 7-Day Trial")}
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

  return (
    <section className="relative overflow-hidden">
      {/* subtle gradient backdrop */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% -10%, rgba(0,102,255,0.10), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(0,102,255,0.06), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Left */}
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
              style={{ borderColor: "rgba(0,102,255,0.25)" }}
            >
              <Star className="h-3.5 w-3.5" style={{ color: BRAND }} />
              {t("landing.hero.eyebrow", "All-in-one Inventory & Operations Platform")}
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-[-0.025em] leading-[1.05] text-slate-900">
              {t(
                "landing.hero.title",
                "Stop losing money to disorganized inventory and manual operations.",
              )}
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              {t(
                "landing.hero.subtitle",
                "InventoryFlow helps restaurants, stores, and growing businesses control inventory, employees, products, and operations from one simple platform.",
              )}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 px-5 text-white shadow-md rounded-xl"
                style={{ backgroundColor: BRAND }}
              >
                <Link to="/checkout" search={{ plan: "starter" }}>
                  <Rocket className="h-4 w-4" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold">
                      {t("landing.hero.ctaPrimary", "Start 7-Day Trial")}
                    </span>
                    <span className="text-[10px] font-normal opacity-90">
                      {t("landing.hero.ctaPrimarySub", "All modules included")}
                    </span>
                  </span>
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-5 rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              >
                <a href={BOOK_DEMO_URL} target="_blank" rel="noopener noreferrer">
                  <Calendar className="h-4 w-4" style={{ color: BRAND }} />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold">
                      {t("landing.hero.ctaDemo", "Schedule Demo")}
                    </span>
                    <span className="text-[10px] font-normal text-slate-500">
                      {t("landing.hero.ctaDemoSub", "See it in action")}
                    </span>
                  </span>
                </a>
              </Button>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
              {[
                t("landing.hero.bullet1", "All modules included"),
                t("landing.hero.bullet2", "Card required"),
                t("landing.hero.bullet3", "Fast onboarding"),
              ].map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: BRAND }}
                  >
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — Dashboard mockup */}
          <div className="relative">
            <DashboardMockup />
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div
      className="relative rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
      style={{ boxShadow: "0 30px 60px -20px rgba(15,23,42,0.25)" }}
    >
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden sm:flex flex-col gap-1 w-12 bg-slate-900 py-4 px-2">
          {[BarChart3, LayoutDashboard, Package, Users, Bell, TrendingUp, Settings].map(
            (Icon, i) => (
              <div
                key={i}
                className={`h-8 w-8 rounded-md flex items-center justify-center ${
                  i === 0 ? "bg-white/10" : ""
                }`}
              >
                <Icon className="h-4 w-4 text-white/80" />
              </div>
            ),
          )}
        </div>

        <div className="flex-1 p-3 sm:p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-900">Dashboard</div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { label: "Total Products", value: "1,245", color: "bg-blue-50 text-blue-700" },
              { label: "Low Stock Alerts", value: "23", color: "bg-amber-50 text-amber-700" },
              { label: "Total Locations", value: "5", color: "bg-emerald-50 text-emerald-700" },
              { label: "Inventory Value", value: "$24,560", color: "bg-violet-50 text-violet-700" },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="text-[9px] uppercase tracking-wider text-slate-500">{k.label}</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{k.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Chart card */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-semibold text-slate-900 mb-2">
                Inventory Overview
              </div>
              <svg viewBox="0 0 200 80" className="w-full h-20">
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={BRAND} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,60 L30,50 L60,55 L90,35 L120,40 L150,20 L180,25 L200,10 L200,80 L0,80 Z"
                  fill="url(#g1)"
                />
                <path
                  d="M0,60 L30,50 L60,55 L90,35 L120,40 L150,20 L180,25 L200,10"
                  fill="none"
                  stroke={BRAND}
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* Alerts */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-semibold text-slate-900 mb-2">Recent Alerts</div>
              <ul className="space-y-1.5">
                {[
                  { name: "Olive Oil", tone: "red" },
                  { name: "Chicken Breast", tone: "red" },
                  { name: "Tomatoes", tone: "amber" },
                  { name: "Paper Cups", tone: "amber" },
                ].map((a) => (
                  <li key={a.name} className="flex items-center gap-2 text-[10px] text-slate-700">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        a.tone === "red" ? "bg-red-500" : "bg-amber-500"
                      }`}
                    />
                    Low stock: {a.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div
      className="hidden md:block absolute -bottom-6 -right-2 lg:-right-6 w-32 lg:w-40 rounded-[1.5rem] bg-slate-900 p-1.5 shadow-2xl"
      style={{ boxShadow: "0 25px 50px -12px rgba(15,23,42,0.35)" }}
    >
      <div className="rounded-[1.2rem] bg-white p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[8px] text-slate-500">9:41</div>
          <div className="text-[9px] font-semibold text-slate-900">Dashboard</div>
        </div>
        <div className="rounded-lg bg-violet-50 p-2">
          <div className="text-[7px] uppercase text-violet-700">Inventory Value</div>
          <div className="text-sm font-bold text-slate-900">$24,560</div>
          <div className="text-[7px] text-emerald-600">+12.5% vs last month</div>
        </div>
        <div className="rounded-lg bg-amber-50 p-2">
          <div className="text-[7px] uppercase text-amber-700">Low Stock Alerts</div>
          <div className="text-sm font-bold text-slate-900">23</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Problem / Solution ---------- */

function ProblemSolution() {
  const { t } = useTranslation();
  const problems = [
    t("landing.ps.p1", "Inventory losses"),
    t("landing.ps.p2", "Excel chaos"),
    t("landing.ps.p3", "Employee mistakes"),
    t("landing.ps.p4", "No operational visibility"),
    t("landing.ps.p5", "Slow manual processes"),
  ];
  const solutions = [
    t("landing.ps.s1", "Real-time inventory tracking"),
    t("landing.ps.s2", "Smart alerts"),
    t("landing.ps.s3", "Employee accountability"),
    t("landing.ps.s4", "Audit logs"),
    t("landing.ps.s5", "Fast operational control"),
  ];

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                {t("landing.ps.problemTitle", "Still running your business manually?")}
              </h2>
              <ul className="mt-5 space-y-3">
                {problems.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-slate-700">
                    <span className="h-6 w-6 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                      <X className="h-3.5 w-3.5 text-red-500" strokeWidth={3} />
                    </span>
                    <span className="text-[15px]">{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                {t("landing.ps.solutionTitle", "InventoryFlow gives you control and clarity.")}
              </h2>
              <ul className="mt-5 space-y-3">
                {solutions.map((s) => (
                  <li key={s} className="flex items-center gap-3 text-slate-700">
                    <span
                      className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(16,185,129,0.12)" }}
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                    </span>
                    <span className="text-[15px]">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Features ---------- */

function Features() {
  const { t } = useTranslation();
  const items = [
    {
      icon: Package,
      title: t("landing.feat.realtime.title", "Real-time Inventory"),
      desc: t("landing.feat.realtime.desc", "Track stock instantly and reduce losses."),
    },
    {
      icon: Users,
      title: t("landing.feat.employee.title", "Employee Control"),
      desc: t("landing.feat.employee.desc", "Know who changed products or inventory."),
    },
    {
      icon: Bell,
      title: t("landing.feat.alerts.title", "Smart Alerts"),
      desc: t("landing.feat.alerts.desc", "Fix inventory problems before they cost money."),
    },
    {
      icon: Smartphone,
      title: t("landing.feat.mobile.title", "Mobile Access"),
      desc: t("landing.feat.mobile.desc", "Manage your business from anywhere."),
    },
    {
      icon: BarChart3,
      title: t("landing.feat.insights.title", "Business Insights"),
      desc: t(
        "landing.feat.insights.desc",
        "Make smarter operational decisions with clear analytics.",
      ),
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {items.map((it) => (
            <div
              key={it.title}
              className="group rounded-2xl bg-white border border-slate-200 p-5 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div
                className="mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-3 transition-colors"
                style={{ backgroundColor: "rgba(0,102,255,0.08)" }}
              >
                <it.icon className="h-6 w-6" style={{ color: BRAND }} />
              </div>
              <div className="text-sm font-semibold text-slate-900">{it.title}</div>
              <div className="mt-1.5 text-xs text-slate-500 leading-snug">{it.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Pricing + Why ---------- */

type PlanKey = "starter" | "pro";

function PricingAndWhy() {
  const { t } = useTranslation();

  const plans: {
    key: PlanKey;
    name: string;
    price: string;
    onboarding: string;
    badge: string;
    badgeColor: string;
    badgeIcon: typeof Star;
    features: string[];
    cta: string;
    ctaTo: string;
    primary: boolean;
  }[] = [
    {
      key: "starter",
      name: t("landing.pricing.plans.starter.name", "Starter"),
      price: t("landing.pricing.plans.starter.price", "$14.99"),
      onboarding: t("landing.pricing.plans.starter.onboarding", "+ $19 one-time Onboarding Process"),
      badge: t("landing.pricing.starterTrial", "7-Day Free Trial"),
      badgeColor: BRAND,
      badgeIcon: Star,
      features: [
        t("landing.pricing.starter.f1", "All modules included"),
        t("landing.pricing.starter.f2", "Up to 3 users"),
        t("landing.pricing.starter.f3", "Up to 500 products"),
        t("landing.pricing.starter.f4", "2 locations"),
      ],
      cta: t("landing.pricing.startStarter", "Start 7-Day Trial"),
      ctaTo: "/checkout?plan=starter",
      primary: true,
    },
    {
      key: "pro",
      name: t("landing.pricing.plans.pro.name", "Pro"),
      price: t("landing.pricing.plans.pro.price", "$79"),
      onboarding: t("landing.pricing.plans.pro.onboarding", "+ $79 guided Onboarding Process"),
      badge: t("landing.pricing.proGrowth", "For growing businesses"),
      badgeColor: "#D97706",
      badgeIcon: Crown,
      features: [
        t("landing.pricing.pro.f1", "All modules included"),
        t("landing.pricing.pro.f2", "Up to 25 users"),
        t("landing.pricing.pro.f3", "Unlimited products"),
        t("landing.pricing.pro.f4", "Multi-location support (10)"),
      ],
      cta: t("landing.pricing.upgradeToPro", "Upgrade to Pro"),
      ctaTo: "/checkout?plan=pro",
      primary: false,
    },
  ];

  const whyItems = [
    { icon: Zap, text: t("landing.why.fast", "Fast onboarding") },
    { icon: Settings, text: t("landing.why.nosetup", "No complicated setup") },
    { icon: Smartphone, text: t("landing.why.mobile", "Mobile friendly") },
    { icon: TrendingUp, text: t("landing.why.realtime", "Real-time inventory tracking") },
    { icon: Users, text: t("landing.why.real", "Designed for real businesses") },
    { icon: Cloud, text: t("landing.why.cloud", "Modern cloud-based platform") },
    { icon: Languages, text: t("landing.why.bilingual", "Bilingual platform (English & Español)") },
  ];

  return (
    <section id="pricing" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-2xl bg-white border p-6 ${
                p.primary
                  ? "border-transparent ring-2 shadow-lg"
                  : "border-slate-200 shadow-sm"
              }`}
              style={p.primary ? { boxShadow: `0 20px 50px -20px rgba(0,102,255,0.35)` } : {}}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-900">{p.name}</div>
                  <div
                    className="mt-1 text-xs font-medium"
                    style={{ color: p.badgeColor }}
                  >
                    {p.badge}
                  </div>
                </div>
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${p.badgeColor}15` }}
                >
                  <p.badgeIcon className="h-4 w-4" style={{ color: p.badgeColor }} />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900">{p.price}</span>
                <span className="text-sm text-slate-500">
                  {t("landing.pricing.perMonth", "/month")}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t("landing.pricing.billedMonthly", "Billed monthly")}
              </div>
              {p.onboarding && (
                <div className="mt-1 text-xs text-slate-500">{p.onboarding}</div>
              )}

              <ul className="mt-5 space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: BRAND }}
                      strokeWidth={3}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={`mt-6 w-full h-11 rounded-xl shadow-none ${
                  p.primary ? "text-white" : "bg-white border border-slate-200 text-slate-900 hover:bg-slate-50"
                }`}
                style={p.primary ? { backgroundColor: BRAND } : {}}
              >
                <Link to={p.ctaTo}>{p.cta}</Link>
              </Button>
              <div className="mt-3 text-center text-[11px] text-slate-500">
                🔒 {t("landing.pricing.cardRequired", "Card required")}
              </div>
            </div>
          ))}

          {/* Why choose */}
          <div
            className="rounded-2xl border border-slate-200 p-6 shadow-sm"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,102,255,0.05) 0%, rgba(255,255,255,1) 60%)",
            }}
          >
            <h3 className="text-lg font-bold text-slate-900 leading-tight">
              {t("landing.why.title", "Why businesses choose InventoryFlow")}
            </h3>
            <ul className="mt-5 space-y-3">
              {whyItems.map((w) => (
                <li key={w.text} className="flex items-center gap-3 text-sm text-slate-700">
                  <span
                    className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(0,102,255,0.10)" }}
                  >
                    <w.icon className="h-3.5 w-3.5" style={{ color: BRAND }} />
                  </span>
                  {w.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */

function FinalCTA() {
  const { t } = useTranslation();
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-3xl p-8 sm:p-10 text-white"
          style={{
            background: `linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND} 60%, #3D87FF 100%)`,
          }}
        >
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-4 left-10 h-2 w-2 rounded-full bg-white" />
            <div className="absolute top-16 left-32 h-1 w-1 rounded-full bg-white" />
            <div className="absolute bottom-10 left-20 h-1.5 w-1.5 rounded-full bg-white" />
            <div className="absolute top-10 right-40 h-1 w-1 rounded-full bg-white" />
          </div>

          <div className="relative grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] items-center gap-6">
            <div className="hidden sm:flex h-20 w-20 rounded-2xl bg-white/15 items-center justify-center shrink-0">
              <Rocket className="h-10 w-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {t("landing.finalCta.title", "Take control of your business today.")}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-white/85 max-w-2xl">
                {t(
                  "landing.finalCta.subtitle",
                  "InventoryFlow helps you organize inventory, employees, and operations faster — without complicated systems.",
                )}
              </p>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-2">
              <Button
                asChild
                size="lg"
                className="h-12 px-6 rounded-xl bg-white text-slate-900 hover:bg-slate-100 shadow-md"
              >
                <Link to="/checkout" search={{ plan: "starter" }}>
                  {t("landing.finalCta.cta", "Start Your 7-Day Trial")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <div className="text-[11px] text-white/80 flex flex-wrap gap-x-3 gap-y-1">
                <span>• {t("landing.finalCta.b1", "All modules included")}</span>
                <span>• {t("landing.finalCta.b2", "Card required")}</span>
                <span>• {t("landing.finalCta.b3", "Quick onboarding")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function SiteFooter() {
  const { t } = useTranslation();
  const cols = [
    {
      title: t("landing.footer.product", "Product"),
      links: [
        { label: t("landing.nav.features", "Features"), href: "#features" },
        { label: t("landing.nav.pricing", "Pricing"), href: "#pricing" },
      ],
    },
    {
      title: t("landing.footer.company", "Company"),
      links: [
        { label: t("landing.footer.about", "About"), href: `mailto:${SUPPORT_EMAIL}` },
        { label: t("landing.footer.contact", "Contact"), href: `mailto:${SUPPORT_EMAIL}` },
      ],
    },
    {
      title: t("landing.footer.resources", "Resources"),
      links: [
        { label: t("landing.nav.helpCenter", "Help Center"), href: `mailto:${SUPPORT_EMAIL}` },
        { label: t("landing.nav.setupGuides", "Setup Guides"), href: `mailto:${SUPPORT_EMAIL}` },
      ],
    },
    {
      title: t("landing.footer.legal", "Legal"),
      links: [
        { label: t("landing.footer.privacy", "Privacy Policy"), href: "/privacy" },
        { label: t("landing.footer.terms", "Terms of Service"), href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}
              >
                <BarChart3 className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold tracking-tight text-slate-900">InventoryFlow</span>
            </Link>
            <p className="mt-3 text-sm text-slate-500 max-w-xs">
              {t("landing.footer.tagline", "Control your inventory. Grow your business.")}
            </p>
            <div className="mt-4">
              <LanguageSwitcher />
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-sm font-semibold text-slate-900">{c.title}</div>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <div className="text-sm font-semibold text-slate-900">
              {t("landing.footer.needHelp", "Need help?")}
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 w-full"
            >
              <Mail className="h-3.5 w-3.5" style={{ color: BRAND }} />
              <span className="flex flex-col leading-tight">
                <span>{t("landing.footer.emailSupport", "Email Support")}</span>
                <span className="text-[10px] text-slate-500">(for USA)</span>
              </span>
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white w-full"
              style={{ backgroundColor: "#25D366" }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="flex flex-col leading-tight">
                <span>{t("landing.footer.whatsapp", "Chat on WhatsApp")}</span>
                <span className="text-[10px] opacity-90">(for LATAM)</span>
              </span>
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap justify-between gap-3">
          <span>© {new Date().getFullYear()} InventoryFlow. All rights reserved.</span>
          <span>{t("landing.footer.builtWith", "Built for growing businesses.")}</span>
        </div>
      </div>
    </footer>
  );
}
