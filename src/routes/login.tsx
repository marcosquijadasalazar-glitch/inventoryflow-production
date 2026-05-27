import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/login")({
  component: () => (
    <ErrorBoundary name="LoginPage" context={{ route: "/login" }}>
      <AuthCard />
    </ErrorBoundary>
  ),
});
