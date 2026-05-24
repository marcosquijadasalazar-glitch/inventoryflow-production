import * as XLSX from "xlsx";

export type ImportFieldSpec = {
  key: string;
  required?: boolean;
  /** Header aliases accepted in uploaded files (case-insensitive). */
  aliases?: string[];
  /** Example value to show in the downloaded template. */
  example?: string | number;
};

export type ImportSchema = {
  /** Entity key, used for filenames + audit log target_type. */
  entity: string;
  /** Sheet name for xlsx template. */
  sheetName?: string;
  fields: ImportFieldSpec[];
};

export type ParsedRow = {
  rowNumber: number; // 1-based excluding header
  data: Record<string, string>;
  errors: string[];
};

/** Download a template .xlsx using the given schema. */
export function downloadTemplate(schema: ImportSchema, filename?: string) {
  const headers = schema.fields.map((f) => f.key);
  const example: Record<string, any> = {};
  schema.fields.forEach((f) => (example[f.key] = f.example ?? ""));
  const ws = XLSX.utils.json_to_sheet([example], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, schema.sheetName ?? schema.entity);
  XLSX.writeFile(wb, filename ?? `${schema.entity}-template.xlsx`);
}

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Parse a CSV or XLSX file into normalized rows. */
export async function parseImportFile(
  file: File,
  schema: ImportSchema,
): Promise<{ rows: ParsedRow[]; unknownHeaders: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], unknownHeaders: [] };
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: "" });
  if (aoa.length === 0) return { rows: [], unknownHeaders: [] };

  const rawHeaders = (aoa[0] as any[]).map((h) => String(h ?? "").trim());
  const headerMap: (string | null)[] = rawHeaders.map((h) => {
    const norm = normalizeHeader(h);
    const match = schema.fields.find(
      (f) =>
        normalizeHeader(f.key) === norm ||
        (f.aliases ?? []).some((a) => normalizeHeader(a) === norm),
    );
    return match ? match.key : null;
  });
  const unknownHeaders = rawHeaders.filter((_, i) => headerMap[i] === null && rawHeaders[i]);

  const required = schema.fields.filter((f) => f.required).map((f) => f.key);
  const rows: ParsedRow[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const arr = aoa[r] as any[];
    if (!arr || arr.every((v) => v === "" || v == null)) continue;
    const data: Record<string, string> = {};
    for (let c = 0; c < headerMap.length; c++) {
      const key = headerMap[c];
      if (!key) continue;
      const val = arr[c];
      data[key] = val == null ? "" : String(val).trim();
    }
    const errors: string[] = [];
    for (const req of required) {
      if (!data[req]) errors.push(`Missing required: ${req}`);
    }
    rows.push({ rowNumber: r, data, errors });
  }
  return { rows, unknownHeaders };
}

export type ImportResult = {
  inserted: number;
  updated?: number;
  failed: number;
  errors: { row: number; message: string }[];
};
