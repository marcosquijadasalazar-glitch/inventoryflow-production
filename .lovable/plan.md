
# Pricing & Trial Architecture Refactor

Scope is large but surgical. Existing Stripe foundation, RBAC, RLS, notifications, billing portal, and onboarding system stay intact — we change the *entry point*, the *plan catalog*, and the *terminology*.

## 1. Plan catalog: drop Free, keep Starter + Pro

- `plan-limits.ts`: remove `free` from `PlanType`, `PLAN_LIMITS`, `PLAN_ORDER`. Default → `starter`.
- DB enum `org_plan` keeps `free` (to avoid breaking existing rows / SQL functions like `plan_limits()` / `plan_modules()`), but:
  - New orgs are provisioned as `starter`.
  - `plan_modules('starter')` and `plan_modules('free')` are aligned so legacy `free` rows still get full module visibility (positive UX: never hide modules).
  - `plan_modules('starter')` updated → all modules visible (history, POs, SOs, transfers, internal use, location stock, reports, exports = true). Starter limits remain via `plan_limits()` (3 users / 500 products / 2 locations).
- `modules.ts` / `use-modules.ts`: keep the gating engine, but Starter no longer disables modules. Pro keeps current settings.

## 2. New signup flow: payment-first

Current: signup form → email confirm → onboarding → (eventually) checkout.
New:
1. Landing CTA "Start 7-Day Trial" / "Get Pro" → `/checkout?plan=starter|pro`.
2. `/checkout` is a thin route that calls a new public server fn `createSignupCheckoutSession({ plan, email })` which:
   - Creates a Stripe Customer (no DB user yet).
   - Creates a Checkout Session in `subscription` mode with `customer_creation: 'always'`, `automatic_tax`, `billing_address_collection: 'required'`, `customer_update: { address: 'auto', name: 'auto' }`.
   - For `starter`: `subscription_data.trial_period_days: 7`, `payment_method_collection: 'always'` (card required during trial).
   - For `pro`: no trial.
   - Adds the onboarding-process one-time line item (renamed setup fee price IDs reused).
   - `success_url = /signup/complete?session_id={CHECKOUT_SESSION_ID}` and `cancel_url = /?checkout=cancelled`.
3. Stripe webhook `checkout.session.completed` (already handled):
   - If `metadata.signup = 'true'` and no `organization_id` yet → create provisional `organizations` row (plan, trial fields, stripe_customer_id, stripe_subscription_id), generate a Supabase auth user via admin client using the checkout email, send a magic-link / password-setup token, write `must_change_password = true` (we already have a change-password route).
4. `/signup/complete` polls `getSignupSession(session_id)` until provisioning is done, then redirects:
   - if no auth session → `/login?firstTime=1&email=...` (user gets the magic link / temp password by email + on-screen).
   - if signed in → `/setup` (existing onboarding flow handles company details, inventory, etc.).

Keep the old `/signup` route as a fallback (employee invitations etc.) but stop linking to it from marketing.

## 3. Onboarding Process terminology

Codebase-wide rename of user-visible strings only (DB columns `setup_fee_paid` etc. stay):
- `BillingPanel.tsx`, `i18n/en.json`, `i18n/es.json`, checkout summary, invoice descriptions, emails.
- Replace "Setup Fee" / "Setup" / "Implementation Fee" → "Onboarding Process".
- Stripe line_item `description` override on checkout to label as "Starter Onboarding Process" / "Pro Onboarding Process".

## 4. Trial & status sync

- `profiles.trial_ends_at` already exists. Add `organizations.is_trialing` (boolean, derived but cached) + reuse existing `subscription_status`.
- Webhook handler: on `customer.subscription.{created,updated,deleted}` set `is_trialing = (status='trialing')`, `trial_ends_at = sub.trial_end`.
- When trial ends without payment failure → status auto-flips to `active` (Stripe charges card) → stays on Starter. No module hiding, no logout. We already handle `past_due` for failed payments.

## 5. Capacity messaging (positive UX)

- `PlanLimitBanner.tsx` + `UpgradeDialog.tsx`: rewrite copy.
  - Title: "Congratulations 🎉 Your business has reached the Starter limit."
  - Body: "Upgrade to Pro to continue scaling your operations."
  - CTA: "Upgrade to Pro".
- Remove any "feature locked" / "not available on your plan" copy; replace with growth framing where it triggers from limits.

## 6. Landing page pricing cards

`src/routes/index.tsx`: remove Free card, keep two cards:
- **Starter** — "7-Day Free Trial · Card required" → CTA `/checkout?plan=starter`.
- **Pro** — "For growing businesses" → CTA `/checkout?plan=pro`.
- Strip all "Free plan / Free forever / Free workspace" copy across landing + i18n.

## 7. DB migration

Single migration:
- Update `plan_modules('starter')` to enable all modules (matches Pro module list).
- Update `plan_modules('free')` similarly (so legacy rows don't lose modules).
- Add `organizations.is_trialing boolean not null default false`.
- Backfill `is_trialing = (subscription_status = 'trialing')`.
- No enum change (preserves data).

## 8. Files to touch

```text
src/lib/plan-limits.ts                          # drop free from TS types
src/lib/billing.functions.ts                    # signup checkout fn, onboarding label
src/lib/stripe.server.ts                        # trial_period_days, line_item description
src/lib/signup-bootstrap.functions.ts           # provisional org creation from webhook
src/routes/api/public/hooks/stripe.ts           # handle signup checkout completion
src/routes/checkout.tsx                         # NEW – plan→Stripe redirect
src/routes/signup-complete.tsx                  # NEW – post-checkout landing
src/routes/index.tsx                            # pricing cards rewrite
src/components/billing/BillingPanel.tsx         # Onboarding Process label, no free plan
src/components/UpgradeDialog.tsx                # positive growth copy
src/components/PlanLimitBanner.tsx              # positive growth copy
src/i18n/en.json, src/i18n/es.json              # terminology + free plan removal
supabase/migrations/<new>.sql                   # plan_modules update + is_trialing
```

## What we explicitly do NOT change

- `app_role` enum, RBAC functions, RLS policies on any table.
- `stripe_customer_id` / `stripe_subscription_id` mapping logic.
- Existing webhook signature verification.
- Notifications, audit logs, billing portal route.
- Onboarding step machine (`setup.tsx`, `onboarding.functions.ts`) — only its *entry point* changes (after payment instead of before).
- Existing employee invitation flow in `org-users.functions.ts`.

Ready to implement on approval.
