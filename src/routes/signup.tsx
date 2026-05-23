import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/signup")({
  component: () => (
    <ErrorBoundary name="SignupPage" context={{ route: "/signup" }}>
      <AuthCard initialMode="signup" />
    </ErrorBoundary>
  ),
});
