import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/transfer-orders")({
  component: TransferOrdersRedirect,
});

function TransferOrdersRedirect() {
  const navigate = useNavigate({ from: "/transfer-orders" });
  useEffect(() => {
    navigate({
      to: "/movements",
      search: (prev: Record<string, any>) => ({ ...prev, tab: "transfers" }),
      replace: true,
    });
  }, [navigate]);
  return null;
}
