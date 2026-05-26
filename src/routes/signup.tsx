import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type SignupSearch = { plan?: "starter" | "pro" };

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): SignupSearch => {
    const plan = search.plan;
    if (plan === "starter" || plan === "pro") return { plan };
    return {};
  },
  component: SignupPage,
});

function SignupPage() {
  const { plan } = Route.useSearch();
  return (
    <ErrorBoundary name="SignupPage" context={{ route: "/signup" }}>
      <AuthCard initialMode="signup" checkoutPlan={plan} />
    </ErrorBoundary>
  );
}
