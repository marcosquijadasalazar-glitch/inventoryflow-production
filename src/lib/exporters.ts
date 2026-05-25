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

/**
 * Print tabular data using a hidden iframe.
 *
 * Renders into an off-screen iframe (no popup), waits for the logo and any
 * embedded images to finish loading, then calls print() and cleans up the
 * iframe after the print dialog closes. This avoids the blank-popup issue
 * caused by popup blockers and racing window.onload + window.print().
 */
export function printRows<T>(opts: {
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  settings: CompanySettings | null;
  userEmail?: string | null;
  /** Filters / date range / etc. printed under the title. */
  meta?: { label: string; value: string }[];
  /** Optional summary rows printed after the table (label / value pairs). */
  summary?: { label: string; value: string }[];
  orientation?: "portrait" | "landscape";
}): Promise<void> {
  const {
    title,
    columns,
    rows,
    settings,
    userEmail,
    meta,
    summary,
    orientation = "landscape",
  } = opts;

  // Fallback when nothing to print — never open a blank window.
  if (!rows || rows.length === 0) {
    if (typeof window !== "undefined") {
      // Best-effort UI feedback; importers of this util always have sonner toast.
      try {
        // Lazy import to avoid hard dep at module top.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { toast } = require("sonner");
        toast.error("Nothing to print");
      } catch {
        // ignore
      }
    }
    return Promise.resolve();
  }

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

  const metaRows = (meta ?? [])
    .filter((m) => m.value != null && m.value !== "")
    .map(
      (m) =>
        `<div class="meta-row"><span class="meta-label">${escapeHtml(m.label)}:</span> <span>${escapeHtml(m.value)}</span></div>`,
    )
    .join("");

  const summaryHtml = summary && summary.length
    ? `<table class="summary"><tbody>${summary
        .map(
          (s) =>
            `<tr><th>${escapeHtml(s.label)}</th><td>${escapeHtml(s.value)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:#111; padding:24px; margin:0; }
  h1 { font-size:18px; margin:0 0 4px; }
  .meta { color:#444; font-size:11px; margin:8px 0 16px; line-height:1.5; }
  .meta-row { margin-right:12px; display:inline-block; }
  .meta-label { color:#888; }
  .brand { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
  .brand img { height:42px; max-width:160px; object-fit:contain; }
  table { width:100%; border-collapse:collapse; font-size:11px; page-break-inside:auto; }
  tr { page-break-inside:avoid; page-break-after:auto; }
  thead { display:table-header-group; }
  tfoot { display:table-footer-group; }
  th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; vertical-align:top; }
  thead th { background:#28283c; color:#fff; }
  tbody tr:nth-child(even){ background:#f5f6fa; }
  .summary { width:auto; margin-top:14px; min-width:280px; }
  .summary th { background:#f0f1f5; color:#111; text-align:left; }
  .footer { margin-top:16px; color:#666; font-size:10px; border-top:1px solid #eee; padding-top:8px; }
  @media print { @page { size: A4 ${orientation}; margin: 12mm; } body { padding:0; } .no-print { display:none !important; } }
</style></head><body>
<div class="brand">
  ${settings?.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" alt="" crossorigin="anonymous"/>` : ""}
  <div>
    <div style="font-weight:600">${escapeHtml(settings?.company_name ?? "InventoryFlow")}</div>
    <div style="color:#666;font-size:11px">${escapeHtml(
      [settings?.address, settings?.phone, settings?.email].filter(Boolean).join(" · "),
    )}</div>
  </div>
</div>
<h1>${escapeHtml(title)}</h1>
<div class="meta">
  <div class="meta-row"><span class="meta-label">Generated:</span> <span>${escapeHtml(new Date().toLocaleString())}</span></div>
  ${userEmail ? `<div class="meta-row"><span class="meta-label">By:</span> <span>${escapeHtml(userEmail)}</span></div>` : ""}
  <div class="meta-row"><span class="meta-label">Rows:</span> <span>${rows.length}</span></div>
  ${metaRows ? `<div style="margin-top:6px">${metaRows}</div>` : ""}
</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
${summaryHtml}
${settings?.footer_notes ? `<div class="footer">${escapeHtml(settings.footer_notes)}</div>` : ""}
</body></html>`;

  return new Promise<void>((resolve) => {
    if (typeof document === "undefined") {
      resolve();
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      // Defer so the print dialog can fully release the iframe document.
      setTimeout(() => {
        try {
          iframe.parentNode?.removeChild(iframe);
        } catch {
          // ignore
        }
        resolve();
      }, 200);
    };

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = async () => {
      try {
        const win = iframe.contentWindow;
        if (!win) {
          cleanup();
          return;
        }
        // Wait for any <img> tags inside the iframe to finish loading.
        const imgs = Array.from(doc.images || []);
        await Promise.all(
          imgs.map(
            (img) =>
              new Promise<void>((res) => {
                if (img.complete) return res();
                const done = () => res();
                img.addEventListener("load", done, { once: true });
                img.addEventListener("error", done, { once: true });
                // Safety timeout — never block printing on a broken image.
                setTimeout(done, 3000);
              }),
          ),
        );
        // Give the layout one paint to settle.
        await new Promise((res) => setTimeout(res, 50));
        win.addEventListener("afterprint", cleanup, { once: true });
        win.focus();
        win.print();
        // Browsers that don't fire afterprint reliably (older Safari): cleanup fallback.
        setTimeout(cleanup, 60_000);
      } catch {
        cleanup();
      }
    };

    // Use the iframe's own load event so we know the document is parsed.
    if (doc.readyState === "complete") {
      triggerPrint();
    } else {
      iframe.addEventListener("load", triggerPrint, { once: true });
      // Fallback in case load doesn't fire for an inline-written doc.
      setTimeout(triggerPrint, 200);
    }
  });
}

function escapeHtml(s: string | null | undefined) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
