/**
 * Barcode Intelligence
 * ---------------------------------------------------------------
 * Lightweight client-side lookup for unknown UPC/EAN barcodes.
 * Uses Open Food Facts public API (no key, CORS-enabled). Returns
 * a normalized suggestion with a confidence score so the UI can
 * present a calm "possible match" experience.
 */

export type BarcodeSuggestion = {
  barcode: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  source: string;
  confidence: "high" | "medium" | "low";
};

const OFF_ENDPOINT = "https://world.openfoodfacts.org/api/v2/product";

function pickFirst(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function scoreConfidence(p: any): BarcodeSuggestion["confidence"] {
  const completeness = Number(p?.completeness ?? 0);
  const hasName = !!(p?.product_name || p?.product_name_en);
  const hasImage = !!(p?.image_front_url || p?.image_url);
  if (hasName && hasImage && completeness >= 0.6) return "high";
  if (hasName && (hasImage || completeness >= 0.4)) return "medium";
  return "low";
}

/**
 * Look up an unknown barcode against public product databases.
 * Returns null when no match is found or the network is unavailable.
 */
export async function lookupBarcodeIntel(
  barcode: string,
  signal?: AbortSignal,
): Promise<BarcodeSuggestion | null> {
  const code = barcode.trim();
  if (!/^\d{6,14}$/.test(code)) return null;

  try {
    const res = await fetch(`${OFF_ENDPOINT}/${code}.json`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.status !== 1 || !json?.product) return null;

    const p = json.product;
    const name: string | null =
      p.product_name || p.product_name_en || p.generic_name || null;
    if (!name) return null;

    return {
      barcode: code,
      name,
      brand: pickFirst(p.brands),
      category: pickFirst(p.categories),
      imageUrl: p.image_front_url || p.image_url || null,
      source: "Open Food Facts",
      confidence: scoreConfidence(p),
    };
  } catch {
    return null;
  }
}
