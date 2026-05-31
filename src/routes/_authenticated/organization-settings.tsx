import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/organization-settings")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "organization" } as any });
  },
  component: () => null,
});
