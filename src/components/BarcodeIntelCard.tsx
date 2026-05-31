import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Package,
  Loader2,
  PackageX,
  PencilLine,
  Plus,
} from "lucide-react";
import {
  lookupBarcodeIntel,
  type BarcodeSuggestion,
} from "@/lib/barcode-intel";

type EditedFields = {
  name: string;
  brand: string;
  category: string;
};

export type BarcodeIntelDecision = {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
};

/**
 * Suggestion card shown when an unknown barcode is scanned.
 * Auto-runs lookup, lets the operator review/edit, then hands
 * decision back to the parent (which opens ProductForm prefilled).
 */
export function BarcodeIntelCard({
  barcode,
  onConfirm,
  onManual,
  onDismiss,
}: {
  barcode: string;
  onConfirm: (decision: BarcodeIntelDecision) => void;
  onManual: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<EditedFields>({
    name: "",
    brand: "",
    category: "",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["barcode-intel", barcode],
    queryFn: ({ signal }) => lookupBarcodeIntel(barcode, signal),
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });

  useEffect(() => {
    if (data) {
      setEdited({
        name: data.name ?? "",
        brand: data.brand ?? "",
        category: data.category ?? "",
      });
    }
  }, [data]);

  if (isLoading) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("scanner.intel.searching", "Looking up this barcode…")}
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageX className="h-5 w-5 text-warning" />
            {t("scanner.intel.noMatch", "No match found for this barcode")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t(
              "scanner.intel.noMatchHint",
              "We couldn't find this product online. You can add it manually in a few seconds.",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="px-2 py-1 bg-muted rounded font-mono text-sm">
              {barcode}
            </code>
            <Button onClick={onManual}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t("scanner.createNewProduct")}
            </Button>
            <Button variant="ghost" onClick={onDismiss}>
              {t("scanner.scanAgain")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const suggestion: BarcodeSuggestion = data;
  const confidenceLabel =
    suggestion.confidence === "high"
      ? t("scanner.intel.confidenceHigh", "Strong match")
      : suggestion.confidence === "medium"
        ? t("scanner.intel.confidenceMedium", "Possible match")
        : t("scanner.intel.confidenceLow", "Low confidence");

  const confidenceClass =
    suggestion.confidence === "high"
      ? "bg-success/15 text-success border-success/30"
      : suggestion.confidence === "medium"
        ? "bg-primary/15 text-primary border-primary/30"
        : "bg-warning/15 text-warning border-warning/30";

  const handleConfirm = () => {
    onConfirm({
      barcode,
      name: edited.name.trim() || suggestion.name || "",
      brand: edited.brand.trim() || suggestion.brand || "",
      category: edited.category.trim() || suggestion.category || "",
      imageUrl: suggestion.imageUrl,
    });
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t(
            "scanner.intel.found",
            "We found a possible match for this barcode.",
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-border bg-background/60 p-3">
          <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {suggestion.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={suggestion.imageUrl}
                alt={suggestion.name ?? barcode}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <Package className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {editing ? (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">
                    {t("pf.name", "Product name")}
                  </Label>
                  <Input
                    value={edited.name}
                    onChange={(e) =>
                      setEdited((s) => ({ ...s, name: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">
                      {t("scanner.intel.brand", "Brand")}
                    </Label>
                    <Input
                      value={edited.brand}
                      onChange={(e) =>
                        setEdited((s) => ({ ...s, brand: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      {t("pf.category", "Category")}
                    </Label>
                    <Input
                      value={edited.category}
                      onChange={(e) =>
                        setEdited((s) => ({ ...s, category: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="font-semibold text-base truncate">
                  {edited.name || suggestion.name}
                </div>
                <div className="text-xs text-muted-foreground space-x-2">
                  {edited.brand && <span>{edited.brand}</span>}
                  {edited.category && (
                    <span className="text-muted-foreground/70">
                      · {edited.category}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {barcode}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={confidenceClass}>
            {confidenceLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t("scanner.intel.source", "Source")}: {suggestion.source}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {t(
            "scanner.intel.review",
            "Review and confirm the details before creating the product.",
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleConfirm}>
            <Plus className="h-4 w-4 mr-1.5" />
            {t("scanner.intel.useDetails", "Use these details")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditing((v) => !v)}
          >
            <PencilLine className="h-4 w-4 mr-1.5" />
            {editing
              ? t("common.done", "Done")
              : t("scanner.intel.edit", "Edit")}
          </Button>
          <Button variant="ghost" onClick={onManual}>
            {t("scanner.intel.startBlank", "Enter manually")}
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            {t("scanner.scanAgain")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
