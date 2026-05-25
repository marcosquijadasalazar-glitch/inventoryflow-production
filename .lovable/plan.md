# Hybrid Onboarding System for InventoryFlow

A modern, bilingual (EN/ES) onboarding flow that gets new companies productive in under 10 minutes. Self-service first, with visible human-support escape hatches (WhatsApp + Book Demo) for LATAM and complex setups.

## Scope

In scope:
- First-login Welcome Wizard (4 steps max)
- Optional demo data seeding
- Product import (reuse existing flow) + team invites (reuse existing flow)
- Success screen
- Dashboard "Getting Started" checklist card
- Lightweight first-time tooltips on key pages
- Onboarding tracking columns + audit log
- Super-admin visibility (onboarding column on companies)
- Full EN/ES translations
- WhatsApp + Book Demo CTAs reused from existing landing config

Out of scope (explicitly preserved):
- Landing page, auth flow, dashboard layout, branding, colors
- RLS / RBAC / org isolation model
- Pricing / plans logic

## Database changes (one migration)

Add to `public.organizations`:
- `onboarding_completed boolean default false`
- `onboarding_step int default 0`
- `onboarding_completed_at timestamptz`
- `demo_data_installed boolean default false`
- `onboarding_dismissed boolean default false` (for checklist dismiss)
- `onboarding_business_size text` (employees bucket)
- `onboarding_product_volume text` (products bucket)
- `onboarding_location_count text` (locations bucket)

Audit: insert into `admin_audit_log` on completion (`action_type = 'onboarding_completed'`).

RLS: no new policies needed — existing org policies on `organizations` already cover read/update; owner/manager can update their own org. Super admin sees all via existing `super_admin all orgs`.

## Server functions (`src/lib/onboarding.functions.ts`)

All `requireSupabaseAuth` + scoped to caller's org via `current_user_org()`-equivalent profile lookup.

- `getOnboardingState()` — returns wizard state for current org
- `updateOnboardingStep({ step, payload })` — partial updates (business info, step pointer)
- `completeOnboarding()` — sets completed flag + timestamp, inserts audit row
- `dismissOnboardingChecklist()`
- `installDemoData()` — uses `supabaseAdmin` to seed: 1 location, 1 supplier, 1 customer, ~6 products with stock, a few inventory movements. Idempotent (no-op if `demo_data_installed`).
- `inviteTeamMembers({ invites: [{email, role}] })` — reuses existing org-users invite path
- `getChecklistProgress()` — counts: has product, has imported (>=5 products), has used scanner (any movement w/ source=barcode_scan), has location, has invited user. Returns booleans + percent.
- Admin: `adminListOnboardingStatus()` — super-admin only; lists orgs with progress + flags.

## UI components

`src/components/onboarding/`
- `WelcomeWizard.tsx` — full-screen modal/sheet shown when `!onboarding_completed && !onboarding_dismissed` and user is owner. Animated step indicator, Skip / Back / Next.
- `StepBusiness.tsx` — business type, product volume bucket, employee bucket, location bucket, preferred language (writes to profile + org).
- `StepDemoData.tsx` — yes/no card; on yes triggers `installDemoData`.
- `StepImport.tsx` — reuses `ImportDialog` for products + template download link; skip allowed.
- `StepInvite.tsx` — multi-row email + role select; skip allowed.
- `SuccessScreen.tsx` — confetti-lite, three CTAs: Go to Dashboard / Watch Quick Demo (opens YouTube link or modal) / Chat on WhatsApp (reuses landing number).
- `GettingStartedCard.tsx` — dashboard checklist card with progress bar, 5 items, dismiss button, and Need Help footer (WhatsApp + Book Demo).
- `FirstTimeTooltip.tsx` — small dismissible tooltip; remembers dismissed keys in `localStorage` per user. Drop into Products, Scanner, Reports, Users pages.
- `NeedHelpCTA.tsx` — shared WhatsApp + Book Demo block, used in wizard + checklist.

## Wiring

- `src/routes/_authenticated.tsx` — after auth + profile load, if user is `owner` and org `!onboarding_completed && !onboarding_dismissed`, render `<WelcomeWizard />` overlay over outlet.
- `src/routes/_authenticated/dashboard.tsx` — render `<GettingStartedCard />` at top when not dismissed and not 100%.
- Tooltips added on `products.tsx`, `scanner.tsx`, `reports.tsx`, `users.tsx`.
- Super-admin: extend `_authenticated/admin.tsx` (companies tab) with onboarding column + filter "needs help" (started but not completed in >3 days).

## i18n

Add `onboarding.*` namespace to `src/i18n/en.json` and `src/i18n/es.json`:
- wizard titles/subtitles/buttons
- step labels + helper text
- demo data success/failure toasts
- success screen
- checklist items
- tooltip copy
- Need-help block

## Tech notes

- Reuses existing landing `WHATSAPP_NUMBER` (export it from a shared `src/lib/contact.ts`).
- Book Demo: opens a Calendly-style URL placeholder — leave a constant `BOOK_DEMO_URL` in `src/lib/contact.ts` for the user to fill (Calendly link).
- Demo data uses `supabaseAdmin` server-side to bypass RLS cleanly; tagged with a `demo_*` SKU prefix so it's easy to identify.
- All server fns scoped strictly by `organization_id` — no cross-org reads.

## Acceptance

- New owner login → wizard appears, can complete in <10 min or skip
- Demo data toggle works and is idempotent
- Checklist updates as user takes actions; dismiss persists
- Full EN/ES toggle works on every onboarding string
- Super-admin sees onboarding column for all orgs
- No regressions to RLS, RBAC, landing, auth, or dashboard layout
