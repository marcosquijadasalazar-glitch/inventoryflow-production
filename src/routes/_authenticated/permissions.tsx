import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/permissions")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "permissions" } as any });
  },
  component: () => null,
});
