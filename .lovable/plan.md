# InventoryFlow v2: History, Barcode, i18n & PDF

This is a large multi-part change. Below is the plan, scoped to keep auth, RLS, landing page, and existing CRUD intact.

## 1. Database (migration)

New tables:

- `transaction_history` — every inventory action
  - `id`, `created_at`
  - `type` (enum: `product_created`, `product_updated`, `product_deleted`, `stock_added`, `stock_removed`, `stock_adjusted`, `low_stock`)
  - `product_id` (nullable for deleted), `product_name`, `sku`, `barcode`
  - `quantity_change` (int, nullable), `previous_stock` (int, nullable), `new_stock` (int, nullable)
  - `reason` (text), `source` (enum: `manual`, `barcode_scan`, `adjustment`, `system`)
  - `user_id` (uuid), `user_email` (text)
- `company_settings` — single-row settings (one per workspace, shared model matches current RLS)
  - `company_name`, `address`, `phone`, `footer_notes`, `logo_url`

RLS: authenticated CRUD on both (matches existing shared-workspace model).

Trigger: extend `apply_movement` (or add a sibling trigger) to write a `transaction_history` row on every `inventory_movements` insert, capturing previous/new stock and detecting low-stock crossings.

For `product_created/updated/deleted` we'll log from the client (`upsertProduct`/`deleteProduct`) since we have the user email there — simplest path that doesn't require auth.uid() plumbing in triggers.

Storage bucket `branding` (public) for the company logo upload.

## 2. Transaction History page

`src/routes/_authenticated/history.tsx`:
- Table with all fields, sortable by date
- Filters: date range, type, product, SKU, barcode, user, source
- Search: name / SKU / barcode / user email
- CSV export (reuse `csv.ts`)
- PDF export (see §5)

`src/lib/history.ts` — query helpers + `logTransaction()` used by product CRUD paths.

## 3. Barcode scanner

`src/routes/_authenticated/scanner.tsx` (also embeddable as dialog):
- Auto-focused barcode input (USB scanners type + Enter)
- Mobile camera scan via `@zxing/browser`
- On scan: look up by barcode → show product card → Add / Remove / Adjust + qty + reason → submit creates a movement with `source='barcode_scan'`
- If not found: "Create new product" button → opens ProductForm prefilled with barcode

"Scan Barcode" button added to Products, Movements, Dashboard headers.

## 4. i18n (English / Spanish)

- `react-i18next` + `i18next` + `i18next-browser-languagedetector`
- `src/i18n/index.ts`, `src/i18n/en.json`, `src/i18n/es.json`
- Language selector in sidebar footer + landing nav, persisted in `localStorage`
- Translate all primary labels across landing, auth, dashboard, products, movements, alerts, history, scanner, settings

## 5. PDF & printing

`@react-pdf/renderer` for PDFs (works in browser, no native deps).

Documents:
- Product detail PDF
- Inventory list PDF (all / selected)
- Transaction history PDF (filtered)
- Purchase order PDF
- Stock count sheet PDF
- Barcode label sheet (uses `jsbarcode` to render SVG barcodes)

All pull company branding from `company_settings`. Print buttons via `window.print()` or "Download PDF" links. Excel export = same CSV with `.xlsx` content type isn't valid; we'll use `xlsx` lib for real `.xlsx` on inventory list + history.

## 6. Settings page

`src/routes/_authenticated/settings.tsx`:
- Company name, address, phone, footer notes
- Logo upload to `branding` bucket
- Language preference

## 7. Navigation

Update `AppLayout.tsx` sidebar to include: Dashboard, Products, Movements, Transaction History, Barcode Scanner, Alerts, Settings — plus language switcher in the footer.

## 8. Files

New:
- `supabase/migrations/<ts>_history_settings.sql`
- `src/lib/history.ts`, `src/lib/settings.ts`, `src/lib/pdf/*.tsx` (product, inventory, history, po, count-sheet, labels), `src/lib/xlsx.ts`
- `src/i18n/{index.ts,en.json,es.json}`
- `src/components/LanguageSwitcher.tsx`, `src/components/BarcodeScanInput.tsx`, `src/components/ScanBarcodeButton.tsx`
- `src/routes/_authenticated/{history,scanner,settings}.tsx`

Edited:
- `src/components/AppLayout.tsx` — nav items, language switcher
- `src/lib/inventory.ts` — call `logTransaction` from product CRUD
- `src/routes/_authenticated/{dashboard,products,movements,alerts}.tsx` — Scan button + i18n labels
- `src/routes/{index,login,signup}.tsx` — i18n labels
- `src/routes/__root.tsx` — init i18n
- `package.json` — add deps

## Notes / constraints

- Excel export uses `xlsx` lib (browser-safe).
- Camera scanning requires HTTPS (preview is HTTPS, fine).
- Logo stored in public storage bucket so it can be embedded in PDFs.
- All existing RLS / auth / landing page logic untouched.
- Spanish copy will be hand-written Latin American SaaS tone, not machine.

This is a big chunk of code (~25-30 files) but each piece is well-scoped. Approve and I'll build it.