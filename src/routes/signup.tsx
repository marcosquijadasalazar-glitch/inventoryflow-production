import { createFileRoute, redirect } from "@tanstack/react-router";

type SignupSearch = { plan?: "starter" | "pro" };

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): SignupSearch => {
    const plan = search.plan;
    if (plan === "starter" || plan === "pro") return { plan };
    return {};
  },
  beforeLoad: ({ search }) => {
    const plan = search.plan === "pro" ? "pro" : "starter";
    throw redirect({
      to: "/checkout",
      search: { plan },
      replace: true,
    });
  },
});
