import type { Product } from "./inventory";

export function productsToCsv(products: Product[]): string {
  const headers = [
    "name",
    "sku",
    "barcode",
    "category",
    "cost",
    "price",
    "stock",
    "min_stock",
    "location",
    "supplier",
  ];
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = products.map((p) =>
    headers.map((h) => escape((p as any)[h])).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
