import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/location-stock")({
  component: () => <Navigate to="/locations" search={{ tab: "stock" } as any} replace />,
});
