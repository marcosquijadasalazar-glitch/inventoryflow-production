import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JsBarcode from "jsbarcode";
import type { Product } from "@/lib/inventory";
import type { TransactionRow } from "@/lib/history";
import type { CompanySettings } from "@/lib/settings";
import { getStockStatus } from "@/lib/stock";

type Doc = jsPDF;

const dollars = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toFixed(2)}`;
const dt = (s: string) => new Date(s).toLocaleString();

async function loadLogoDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function drawHeader(
  doc: Doc,
  title: string,
  settings: CompanySettings | null,
) {
  const logoData = await loadLogoDataUrl(settings?.logo_url);
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", 40, 30, 60, 60);
    } catch {}
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings?.company_name ?? "InventoryFlow", logoData ? 110 : 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  const subParts = [settings?.address, settings?.phone, settings?.email].filter(
    Boolean,
  );
  if (subParts.length) doc.text(subParts.join(" · "), logoData ? 110 : 40, 65);

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 40, 110);
  doc.setDrawColor(220);
  doc.line(40, 118, 555, 118);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 132);
  doc.setTextColor(20);
}

function drawFooter(doc: Doc, settings: CompanySettings | null) {
  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    if (settings?.footer_notes) {
      doc.text(settings.footer_notes, 40, 810);
    }
    doc.text(`Page ${i} / ${pages}`, 520, 810);
    doc.setTextColor(20);
  }
}

function save(doc: Doc, name: string) {
  doc.save(name);
}

// ---------- INVENTORY LIST ----------
export async function exportInventoryListPdf(
  products: Product[],
  settings: CompanySettings | null,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await drawHeader(doc, "Inventory List", settings);
  autoTable(doc, {
    startY: 145,
    head: [
      ["Name", "SKU", "Cat.", "Loc.", "Stock", "Min", "Cost", "Price", "Value", "Status"],
    ],
    body: products.map((p) => {
      const s = getStockStatus(p);
      return [
        p.name,
        p.sku,
        p.category ?? "—",
        p.location ?? "—",
        String(p.stock),
        String(p.min_stock),
        dollars(p.cost),
        dollars(p.price),
        dollars(Number(p.cost) * p.stock),
        s,
      ];
    }),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    margin: { left: 40, right: 40 },
  });
  drawFooter(doc, settings);
  save(doc, `inventory-${Date.now()}.pdf`);
}

// ---------- SINGLE PRODUCT SHEET ----------
export async function exportProductPdf(
  product: Product,
  settings: CompanySettings | null,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await drawHeader(doc, "Product Sheet", settings);
  const rows: [string, string][] = [
    ["Name", product.name],
    ["SKU", product.sku],
    ["Barcode", product.barcode ?? "—"],
    ["Category", product.category ?? "—"],
    ["Supplier", product.supplier ?? "—"],
    ["Location", product.location ?? "—"],
    ["Stock", String(product.stock)],
    ["Min stock", String(product.min_stock)],
    ["Cost", dollars(product.cost)],
    ["Price", dollars(product.price)],
    ["Inventory value", dollars(Number(product.cost) * product.stock)],
    ["Last updated", dt(product.updated_at)],
    ["Status", getStockStatus(product)],
  ];
  autoTable(doc, {
    startY: 145,
    body: rows,
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 140, textColor: 80 } },
    margin: { left: 40, right: 40 },
  });

  if (product.barcode) {
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, product.barcode, { format: "CODE128", height: 60, margin: 0 });
      const png = canvas.toDataURL("image/png");
      const y = (doc as any).lastAutoTable.finalY + 30;
      doc.addImage(png, "PNG", 40, y, 200, 60);
    } catch {}
  }
  drawFooter(doc, settings);
  save(doc, `product-${product.sku}-${Date.now()}.pdf`);
}

// ---------- TRANSACTION HISTORY ----------
export async function exportHistoryPdf(
  rows: TransactionRow[],
  settings: CompanySettings | null,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  await drawHeader(doc, "Transaction History", settings);
  autoTable(doc, {
    startY: 145,
    head: [["Date", "Type", "Source", "Product", "SKU", "Qty", "Prev", "New", "Reason", "User"]],
    body: rows.map((r) => [
      dt(r.created_at),
      r.type,
      r.source,
      r.product_name ?? "—",
      r.sku ?? "—",
      r.quantity_change != null ? String(r.quantity_change) : "—",
      r.previous_stock != null ? String(r.previous_stock) : "—",
      r.new_stock != null ? String(r.new_stock) : "—",
      r.reason ?? "—",
      r.user_email ?? "—",
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    margin: { left: 40, right: 40 },
  });
  drawFooter(doc, settings);
  save(doc, `history-${Date.now()}.pdf`);
}

// ---------- PURCHASE ORDER ----------
export type PoLine = {
  product: Product;
  quantity: number;
};
export async function exportPurchaseOrderPdf(opts: {
  poNumber: string;
  supplier: string;
  lines: PoLine[];
  notes?: string;
  settings: CompanySettings | null;
}) {
  const { poNumber, supplier, lines, notes, settings } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await drawHeader(doc, `Purchase Order — ${poNumber}`, settings);

  doc.setFontSize(10);
  doc.text(`Supplier: ${supplier}`, 40, 150);
  doc.text(`PO Date: ${new Date().toLocaleDateString()}`, 40, 165);

  autoTable(doc, {
    startY: 185,
    head: [["SKU", "Name", "Qty", "Unit Cost", "Line Total"]],
    body: lines.map((l) => [
      l.product.sku,
      l.product.name,
      String(l.quantity),
      dollars(l.product.cost),
      dollars(Number(l.product.cost) * l.quantity),
    ]),
    foot: [[
      "",
      "",
      "",
      "Total",
      dollars(
        lines.reduce((s, l) => s + Number(l.product.cost) * l.quantity, 0),
      ),
    ]],
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    footStyles: { fillColor: [230, 232, 240], textColor: 30, fontStyle: "bold" },
    margin: { left: 40, right: 40 },
  });

  if (notes) {
    const y = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notes", 40, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(notes, 500), 40, y + 14);
  }
  drawFooter(doc, settings);
  save(doc, `po-${poNumber}-${Date.now()}.pdf`);
}

// ---------- STOCK COUNT SHEET ----------
export async function exportCountSheetPdf(
  products: Product[],
  settings: CompanySettings | null,
  warehouse?: string,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await drawHeader(doc, "Stock Count Sheet", settings);
  doc.setFontSize(10);
  doc.text(`Warehouse: ${warehouse ?? "—"}`, 40, 150);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 300, 150);

  autoTable(doc, {
    startY: 170,
    head: [["SKU", "Name", "Barcode", "Location", "Expected", "Counted", "Notes"]],
    body: products.map((p) => [
      p.sku,
      p.name,
      p.barcode ?? "—",
      p.location ?? "—",
      String(p.stock),
      "",
      "",
    ]),
    styles: { fontSize: 9, cellPadding: 6, minCellHeight: 22 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    columnStyles: {
      5: { cellWidth: 70 },
      6: { cellWidth: 120 },
    },
    margin: { left: 40, right: 40 },
  });

  const y = (doc as any).lastAutoTable.finalY + 40;
  doc.setFontSize(10);
  doc.text("Counted by: ______________________________", 40, y);
  doc.text("Signature: ______________________________", 320, y);
  drawFooter(doc, settings);
  save(doc, `count-sheet-${Date.now()}.pdf`);
}

// ---------- BARCODE LABELS ----------
export async function exportBarcodeLabelsPdf(
  products: Product[],
  settings: CompanySettings | null,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cols = 3;
  const rows = 8;
  const marginX = 30;
  const marginY = 30;
  const labelW = (595 - marginX * 2) / cols;
  const labelH = (842 - marginY * 2) / rows;

  let i = 0;
  for (const p of products) {
    if (!p.barcode) continue;
    if (i > 0 && i % (cols * rows) === 0) doc.addPage();
    const idx = i % (cols * rows);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = marginX + col * labelW;
    const y = marginY + row * labelH;

    doc.setDrawColor(220);
    doc.rect(x + 4, y + 4, labelW - 8, labelH - 8);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(doc.splitTextToSize(p.name, labelW - 16), x + 10, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`SKU: ${p.sku}`, x + 10, y + 34);
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, p.barcode, {
        format: "CODE128",
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 0,
      });
      doc.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        x + 10,
        y + 42,
        labelW - 20,
        labelH - 60,
      );
    } catch {}
    i++;
  }
  drawFooter(doc, settings);
  save(doc, `labels-${Date.now()}.pdf`);
}

// ---------- PACKING SLIP ----------
export async function exportPackingSlipPdf(opts: {
  products: { product: Product; quantity: number }[];
  recipient: string;
  settings: CompanySettings | null;
}) {
  const { products, recipient, settings } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await drawHeader(doc, "Packing Slip", settings);
  doc.setFontSize(10);
  doc.text(`Ship to: ${recipient}`, 40, 150);
  autoTable(doc, {
    startY: 175,
    head: [["SKU", "Name", "Qty"]],
    body: products.map((p) => [p.product.sku, p.product.name, String(p.quantity)]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    margin: { left: 40, right: 40 },
  });
  drawFooter(doc, settings);
  save(doc, `packing-slip-${Date.now()}.pdf`);
}

export async function exportSalesOrderInvoicePdf(opts: {
  so: {
    so_number: string;
    order_date: string | null;
    notes: string | null;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    amount_paid: number;
    balance_due: number;
    payment_status: string;
    payment_method: string | null;
    customers?: { name: string; email?: string | null; phone?: string | null; address?: string | null } | null;
    items?: {
      product_name: string | null;
      sku: string | null;
      quantity: number;
      unit_price: number;
      line_total: number;
    }[];
  };
  settings: CompanySettings | null;
  autoPrint?: boolean;
}) {
  const { so, settings, autoPrint } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await drawHeader(doc, "Invoice", settings);

  doc.setFontSize(10);
  doc.setTextColor(20);
  let y = 150;
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice #: ${so.so_number}`, 40, y);
  doc.setFont("helvetica", "normal");
  if (so.order_date) doc.text(`Date: ${so.order_date}`, 300, y);
  y += 16;

  if (so.customers) {
    doc.setFont("helvetica", "bold");
    doc.text("Bill to:", 40, y);
    doc.setFont("helvetica", "normal");
    y += 14;
    doc.text(so.customers.name, 40, y);
    y += 12;
    const lines = [so.customers.email, so.customers.phone, so.customers.address].filter(Boolean) as string[];
    for (const l of lines) {
      doc.text(l, 40, y);
      y += 12;
    }
  }

  autoTable(doc, {
    startY: y + 10,
    head: [["SKU", "Product", "Qty", "Unit", "Line"]],
    body: (so.items ?? []).map((i) => [
      i.sku ?? "",
      i.product_name ?? "",
      String(i.quantity),
      dollars(i.unit_price),
      dollars(i.line_total),
    ]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;
  const rightX = 555;
  const labelX = 380;
  let ty = finalY;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", labelX, ty); doc.text(dollars(so.subtotal), rightX, ty, { align: "right" }); ty += 14;
  if (so.tax) { doc.text("Tax", labelX, ty); doc.text(dollars(so.tax), rightX, ty, { align: "right" }); ty += 14; }
  if (so.discount) { doc.text("Discount", labelX, ty); doc.text(`-${dollars(so.discount)}`, rightX, ty, { align: "right" }); ty += 14; }
  doc.setFont("helvetica", "bold");
  doc.text("Total", labelX, ty); doc.text(dollars(so.total), rightX, ty, { align: "right" }); ty += 18;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text("Amount paid", labelX, ty); doc.text(dollars(so.amount_paid), rightX, ty, { align: "right" }); ty += 14;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(so.balance_due > 0 ? 180 : 20, so.balance_due > 0 ? 40 : 20, 40);
  doc.text("Balance due", labelX, ty); doc.text(dollars(so.balance_due), rightX, ty, { align: "right" }); ty += 18;

  doc.setTextColor(20);
  doc.setFont("helvetica", "normal");
  doc.text(`Payment status: ${so.payment_status.toUpperCase()}`, 40, ty);
  if (so.payment_method) doc.text(`Method: ${so.payment_method}`, 300, ty);
  ty += 14;
  if (so.notes) {
    ty += 6;
    doc.setTextColor(100);
    doc.text(`Notes: ${so.notes}`, 40, ty);
    doc.setTextColor(20);
  }

  drawFooter(doc, settings);
  if (autoPrint) {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  } else {
    save(doc, `invoice-${so.so_number}.pdf`);
  }
}
