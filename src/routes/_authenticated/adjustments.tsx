import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/adjustments")({
  component: AdjustmentsRedirect,
});

function AdjustmentsRedirect() {
  const navigate = useNavigate({ from: "/adjustments" });
  useEffect(() => {
    navigate({
      to: "/movements",
      search: (prev: Record<string, any>) => ({ ...prev, tab: "adjustments" }),
      replace: true,
    });
  }, [navigate]);
  return null;
}
