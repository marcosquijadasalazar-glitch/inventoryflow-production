import { AlertTriangle } from "lucide-react";
import {
  getAvailableAtLocation,
  getOnHandAtLocation,
  type ProductLocationStockData,
} from "@/lib/product-location-stock";

export function LocationAvailabilityHint({
  productId,
  locationId,
  stockData,
}: {
  productId: string | null;
  locationId: string | null;
  stockData: ProductLocationStockData | undefined;
}) {
  if (!productId || !locationId) return null;
  const available = getAvailableAtLocation(productId, locationId, stockData);
  if (available == null) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Available at selected location:{" "}
      <span className="font-medium text-foreground">{available}</span>
    </p>
  );
}

export function LocationStockValidationAlert({
  message,
}: {
  message?: string;
}) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  );
}

export function LocationAdjustmentHint({
  productId,
  locationId,
  stockData,
  newQuantity,
}: {
  productId: string | null;
  locationId: string | null;
  stockData: ProductLocationStockData | undefined;
  newQuantity: number | null;
}) {
  if (!productId || !locationId) return null;
  const onHand = getOnHandAtLocation(productId, locationId, stockData);
  if (onHand == null) return null;
  const diff =
    newQuantity == null || Number.isNaN(newQuantity) ? null : newQuantity - onHand;
  return (
    <p className="text-xs text-muted-foreground">
      Current at location:{" "}
      <span className="font-medium text-foreground">{onHand}</span>
      {diff != null && (
        <>
          {" · "}
          Difference:{" "}
          <span
            className={
              diff > 0
                ? "font-semibold text-success"
                : diff < 0
                  ? "font-semibold text-destructive"
                  : "font-medium"
            }
          >
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        </>
      )}
    </p>
  );
}
