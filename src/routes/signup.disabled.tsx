import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/signup/disabled")({
  beforeLoad: () => {
    throw redirect({
      to: "/checkout",
      search: { plan: "starter" },
      replace: true,
    });
  },
});