import { Link } from "@tanstack/react-router";
import { Boxes, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export type LegalSection = {
  heading: string;
  body?: ReactNode;
  bullets?: string[];
  groups?: { intro?: string; bullets: string[]; outro?: string }[];
};

export function LegalPage({
  title,
  subtitle,
  effectiveDate = "[TO BE ADDED]",
  intro,
  sections,
}: {
  title: string;
  subtitle?: string;
  effectiveDate?: string;
  intro?: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link to="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back home
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Legal</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Effective Date: {effectiveDate}
          </p>
        </div>

        {intro && (
          <div className="prose prose-sm dark:prose-invert max-w-none mb-8 text-foreground/90 leading-relaxed">
            {intro}
          </div>
        )}

        <div className="space-y-8">
          {sections.map((s, i) => (
            <section key={i} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {i + 1}. {s.heading}
              </h2>
              {s.body && (
                <div className="text-sm text-foreground/85 leading-relaxed">{s.body}</div>
              )}
              {s.bullets && (
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/85">
                  {s.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
              {s.groups?.map((g, gi) => (
                <div key={gi} className="space-y-2">
                  {g.intro && (
                    <p className="text-sm text-foreground/85 leading-relaxed">{g.intro}</p>
                  )}
                  <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/85">
                    {g.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                  {g.outro && (
                    <p className="text-sm text-foreground/85 leading-relaxed">{g.outro}</p>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-14 border-t border-border/60 pt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} SamVic Technologies</span>
          <div className="flex items-center gap-5">
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/service-agreement" className="hover:text-foreground">Service Agreement</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
