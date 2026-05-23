import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { CompanySettings } from "./settings";

export type ExportColumn<T = any> = {
  key: string;
  header: string;
  /** Cell accessor. Default: row[key]. */
  get?: (row: T) => any;
  /** Optional column width (PDF, pt). */
  width?: number;
  /** Right-align numeric. */
  align?: "left" | "right" | "center";
};

const fmt = (v: any) => {
  if (v == null) return "";
  if (v instanceof Date) return v.toLocaleString();
  return String(v);
};

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

function escapeCsv(v: any) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function trigger(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRowsCsv<T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
) {
  const headers = columns.map((c) => c.header);
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) =>
      columns
        .map((c) => escapeCsv(fmt(c.get ? c.get(r) : (r as any)[c.key])))
        .join(","),
    ),
  ];
  trigger(
    new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }),
    `${filename}-${stamp()}.csv`,
  );
}

export function exportRowsXlsx<T>(
  filename: string,
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
) {
  const data = rows.map((r) => {
    const out: Record<string, any> = {};
    for (const c of columns) out[c.header] = c.get ? c.get(r) : (r as any)[c.key];
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Sheet1");
  XLSX.writeFile(wb, `${filename}-${stamp()}.xlsx`);
}

async function loadLogoDataUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportRowsPdf<T>(opts: {
  filename: string;
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  settings: CompanySettings | null;
  userEmail?: string | null;
  orientation?: "portrait" | "landscape";
  meta?: { label: string; value: string }[];
  autoPrint?: boolean;
}) {
  const {
    filename,
    title,
    columns,
    rows,
    settings,
    userEmail,
    orientation = columns.length > 6 ? "landscape" : "portrait",
    meta,
    autoPrint,
  } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header with branding
  const logo = await loadLogoDataUrl(settings?.logo_url);
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 40, 30, 50, 50);
    } catch {}
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(settings?.company_name ?? "InventoryFlow", logo ? 100 : 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  const sub = [settings?.address, settings?.phone, settings?.email]
    .filter(Boolean)
    .join(" · ");
  if (sub) doc.text(sub, logo ? 100 : 40, 65);

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 40, 105);
  doc.setDrawColor(220);
  doc.line(40, 113, pageWidth - 40, 113);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  const genLine = `Generated ${new Date().toLocaleString()}${userEmail ? ` · by ${userEmail}` : ""} · ${rows.length} row${rows.length === 1 ? "" : "s"}`;
  doc.text(genLine, 40, 127);

  let y = 140;
  if (meta?.length) {
    doc.setTextColor(60);
    meta.forEach((m, i) => {
      doc.text(`${m.label}: ${m.value}`, 40 + (i % 3) * 180, y + Math.floor(i / 3) * 12);
    });
    y += Math.ceil(meta.length / 3) * 12 + 6;
  }
  doc.setTextColor(20);

  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) =>
      columns.map((c) => fmt(c.get ? c.get(r) : (r as any)[c.key])),
    ),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    columnStyles: columns.reduce((acc, c, i) => {
      acc[i] = {
        ...(c.width ? { cellWidth: c.width } : {}),
        ...(c.align ? { halign: c.align } : {}),
      };
      return acc;
    }, {} as any),
    margin: { left: 40, right: 40 },
  });

  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    if (settings?.footer_notes) {
      doc.text(settings.footer_notes, 40, pageHeight - 24);
    }
    doc.text(`Page ${i} / ${pages}`, pageWidth - 80, pageHeight - 24);
    doc.setTextColor(20);
  }

  if (autoPrint) {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(`${filename}-${stamp()}.pdf`);
  }
}

/** Open a print-friendly HTML window with the same tabular data. */
export function printRows<T>(opts: {
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  settings: CompanySettings | null;
  userEmail?: string | null;
}) {
  const { title, columns, rows, settings, userEmail } = opts;
  const head = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${columns
          .map(
            (c) =>
              `<td${c.align ? ` style="text-align:${c.align}"` : ""}>${escapeHtml(
                fmt(c.get ? c.get(r) : (r as any)[c.key]),
              )}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const win = window.open("", "_blank", "noopener,noreferrer,width=1024,height=720");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:#111; padding:24px; }
  h1 { font-size:18px; margin:0 0 4px; }
  .meta { color:#666; font-size:12px; margin-bottom:16px; }
  .brand { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
  .brand img { height:42px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; }
  thead { background:#28283c; color:#fff; }
  tbody tr:nth-child(even){ background:#f5f6fa; }
  .footer { margin-top:16px; color:#888; font-size:10px; }
  @media print { @page { size: A4 landscape; margin: 12mm; } body { padding:0; } }
</style></head><body>
<div class="brand">
  ${settings?.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" alt=""/>` : ""}
  <div>
    <div style="font-weight:600">${escapeHtml(settings?.company_name ?? "InventoryFlow")}</div>
    <div style="color:#666;font-size:11px">${escapeHtml(
      [settings?.address, settings?.phone, settings?.email].filter(Boolean).join(" · "),
    )}</div>
  </div>
</div>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Generated ${new Date().toLocaleString()}${userEmail ? ` · by ${escapeHtml(userEmail)}` : ""} · ${rows.length} row${rows.length === 1 ? "" : "s"}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
${settings?.footer_notes ? `<div class="footer">${escapeHtml(settings.footer_notes)}</div>` : ""}
<script>window.onload=()=>setTimeout(()=>window.print(),250);</script>
</body></html>`);
  win.document.close();
}

function escapeHtml(s: string | null | undefined) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
