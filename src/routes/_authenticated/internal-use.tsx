import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/internal-use")({
  beforeLoad: () => {
    throw redirect({
      to: "/movements",
      search: { tab: "internal-use" },
      replace: true,
    });
  },
});
