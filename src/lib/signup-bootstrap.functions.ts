// Legacy signup bootstrap disabled.
// InventoryFlow now uses payment-first onboarding only.
//
// Correct flow:
// Landing/Pricing → /checkout?plan=starter|pro
// Stripe Checkout → checkout.session.completed webhook
// webhook creates organization + Supabase auth user
// /signup-complete completes onboarding

export async function bootstrapOrgForSignup() {
  throw new Error(
    "Legacy signup bootstrap is disabled. Use payment-first Stripe checkout flow."
  );
}