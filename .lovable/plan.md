
# Barcode Scanner Phase 4 — Implementation Plan

Phase 4 is large (10 sub-features). To keep InventoryFlow simple and avoid bloating the scanner UI, I'll group the work into focused changes and reuse existing patterns (ZXing, `createMovement`, `insights.functions`, `usePermissions`, i18n). No redesign — additive only.

## Scope summary

| # | Feature | Approach |
|---|---|---|
| 1 | Hands-free continuous scan | Toggle in BatchMode; keep camera open after a successful decode, auto-add, beep+vibrate, visible "Hands-Free ON" badge |
| 2 | Smart duplicate detection | Replace 1s ref-throttle with per-code map (configurable window, default 2.5s). Toast: "Duplicate scan ignored" |
| 3 | Offline scan queue | New `src/lib/scan-queue.ts` using `localStorage` + `navigator.onLine` + `online`/`offline` events. Queues `createMovement` payloads, retries on reconnect, dedupes by client UUID. Status pill (Online / Offline / Syncing / N pending) in scanner header |
| 4 | Barcode label generation | Add `bwip-js` (pure JS, Worker-safe). New `LabelPrintDialog` with Code128/EAN/UPC auto-detect, print + PDF download (jsPDF already used in `src/lib/pdf.ts`). Button in Product Found card + ProductDetailsDialog |
| 5 | QR code support | ZXing's `BrowserMultiFormatReader` already decodes QR. Treat result text: if URL with `inventoryflow://product/<id>` or `loc:<id>`, route accordingly; unsupported → friendly toast |
| 6 | Smart scan shortcuts | "Frequent Today" strip above product card — derived from existing `scanner-history-v1` localStorage + today's `transaction_history`. Tap to re-open product |
| 7 | Scan analytics | New `getScannerAnalytics` server fn (today's scans, top 5 products, busiest location, receive/transfer counts). Compact `ScannerAnalyticsCard` rendered in a collapsible section |
| 8 | Advanced scanner permissions | Add `print_labels` to `app_permission` enum + `ALL_PERMISSIONS`. Reuse existing `use_barcode_scanner`, `adjust_stock`, `create_movements`, `manage_transfer_orders` to gate hands-free actions, label printing, receive, transfer (already partially gated) |
| 9 | Scanner activity timeline | Server fn querying `transaction_history` filtered to `source = 'barcode_scan'`, last 50, org-scoped. Compact list (user_email • product • qty • time) in collapsible "Activity" panel |
| 10 | Performance / UX | Lazy-load label generator chunk; memoize shortcut derivation; keep panels collapsed by default on mobile |

## File changes

### New files
- `src/lib/scan-queue.ts` — offline queue (localStorage, online listeners, dedupe)
- `src/lib/scanner-analytics.functions.ts` — `getScannerAnalytics`, `getScannerActivity` server fns
- `src/components/LabelPrintDialog.tsx` — barcode label preview + print/PDF
- `src/components/ScannerAnalyticsPanel.tsx` — analytics + activity timeline
- `src/components/ScannerStatusPill.tsx` — online/offline/syncing indicator
- `src/components/FrequentTodayStrip.tsx` — shortcut chips

### Edited files
- `src/routes/_authenticated/scanner.tsx` — wire hands-free toggle, status pill, frequent strip, analytics panel, smart duplicate logic, queue integration
- `src/components/BarcodeScanInput.tsx` — `continuous` prop (don't stop camera on decode in hands-free mode), expose decode callback for QR routing
- `src/components/ProductDetailsDialog.tsx` — "Print Label" button
- `src/lib/permissions.ts` — add `print_labels` constant
- `src/i18n/en.json`, `src/i18n/es.json` — ~40 new keys

### Migration
- Add `print_labels` value to `app_permission` enum; grant by default to owner/manager (mirror `adjust_stock` defaults)

### Dependency
- `bun add bwip-js` (pure JS, Worker-compatible)

## Out of scope
- Full offline app shell (only scanner workflow continuity, as requested)
- Bin/location QR creation UI (decode is supported; creation deferred)
- Redesign of scanner page

## Risk notes
- Hands-free needs careful camera lifecycle so torch/track state isn't reset on each decode
- Offline queue must reject duplicates by client UUID before insert to avoid double-posting on reconnect
- `bwip-js` is ~150KB; lazy-imported only inside `LabelPrintDialog`

After approval I'll start with the migration (permission enum), then ship the code changes in two batches: (a) core automation — hands-free, dupes, queue, status pill; (b) labels, QR routing, analytics, activity, shortcuts.
