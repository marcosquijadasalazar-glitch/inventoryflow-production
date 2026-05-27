## Goal

Evolve **Location Stock** into a hierarchical inventory browser (Location → Sub-location → Aisle → Bin) with inline stock actions, while preserving the current page's design system, card/table styles, and SMB-friendly feel.

---

## 1. Database (single migration)

Extend the existing `locations` table rather than introducing a parallel table, so RLS/grants/audit already in place are inherited automatically.

```text
locations
  + parent_id      uuid  null  (self-FK)
  + node_level     text  not null default 'location'
                    check (node_level in ('location','sublocation','aisle','bin'))
  + code           text  null   (short code, e.g. "A-01")
```

Index on `(organization_id, parent_id)` for fast tree queries. Existing rows default to `node_level='location'`, `parent_id=null` — fully backward compatible.

Products keep the existing `location` text field for backward compatibility, plus a new optional `bin_id uuid` pointer for fine-grained placement (nullable; no migration of old data).

```text
products
  + bin_id uuid null  (FK conceptually to locations.id where node_level='bin')
```

RLS: reuse existing `org delete/insert/read/update locations` and `products` policies — no new policies needed. Grants already present.

## 2. Hierarchy data layer

New `src/lib/location-tree.ts`:
- `listNodes(parentId | null, level?)` — fetches children
- `createNode({ name, parent_id, node_level, code?, address?, type?, notes? })`
- `updateNode`, `deleteNode`
- `getBreadcrumb(nodeId)` — walks parents
- `getDescendantBinIds(nodeId)` — recursive (client-side BFS over fetched rows)

## 3. Page restructure (`location-stock.tsx`)

Keep current layout, header, ExportMenu, search input, and table styles. **No redesign.** Add:

- **Breadcrumb strip** above the existing card: `Locations / Cold Storage / Aisle A / Bin A-01`
- **Hierarchy cards row** — when no leaf bin is selected, show clickable cards for children of current node (same Card style already used)
- **Action buttons** in top-right cluster (next to ExportMenu): `New Location` (root view), `New Sub-location` / `New Aisle` / `New Bin` (contextual based on current node level)
- **Existing stock table** stays — now scoped to current node + descendants. Add an **Actions** column (kebab menu)

## 4. Inline stock actions (per row)

New `src/components/StockActionsMenu.tsx` with DropdownMenu:
- Add Stock → reuses existing `inventory_movements` insert (`type='add'`)
- Remove Stock → `type='remove'` with reason
- Adjust Quantity → `type='adjustment'` (preview shows diff)
- Move Product → creates a `transfer_orders` row (from current bin/location → target) + `transfer_order_items`, status `completed` so existing per-location math picks it up
- View Product → opens existing `ProductDetailsDialog`

All flows use existing `Dialog` / `Sheet` patterns already in the project (mobile-first bottom sheet on small viewports via responsive `Sheet`).

Audit logging: piggy-backs on existing `log_movement_history` trigger — no new code needed.

## 5. Create-node modals

Single `LocationNodeDialog.tsx` parameterized by `level` — renders the right fields (name, code [aisle/bin], address [location], type [location/sublocation], notes, optional "default location" toggle for root). Parent is prefilled from current breadcrumb.

## 6. Search + filters

Extend existing search input to also match: aisle code, bin code, sub-location name. New filter chips row above the table: **Low stock**, **Empty bins**, **Recent movement (7d)**, **Out of stock**. Computed client-side from already-loaded `products` + `lastMoves`.

## 7. Stock status visuals

Replace the current single `Badge` with a small helper `StockBadge` returning one of:
- `In stock` (subtle muted)
- `Low stock` (warning tint — existing token)
- `Critical` (destructive-soft)
- `Out of stock` (muted outline)

Driven by `product.min_stock` thresholds already on the schema.

## 8. Mobile UX

- Hierarchy cards: 1-col on `<sm`, 2-col `sm`, 3-col `md+`
- Table → on `<md`, switch to compact card-list (one product card per row with action menu)
- All dialogs become `Sheet side="bottom"` on `<md` via the existing `useIsMobile` hook

## 9. New files

- `src/lib/location-tree.ts`
- `src/components/StockActionsMenu.tsx`
- `src/components/stock-actions/AddStockDialog.tsx`
- `src/components/stock-actions/RemoveStockDialog.tsx`
- `src/components/stock-actions/AdjustStockDialog.tsx`
- `src/components/stock-actions/MoveStockDialog.tsx`
- `src/components/LocationNodeDialog.tsx`
- `src/components/HierarchyBreadcrumb.tsx`
- `src/components/HierarchyChildrenGrid.tsx`
- `src/components/StockBadge.tsx`

## 10. Edited files

- `src/routes/_authenticated/location-stock.tsx` — add breadcrumb, hierarchy grid, actions column, filter chips. **No restyle** of existing pieces.
- `src/i18n/en.json`, `src/i18n/es.json` — ~35 new keys

## Out of scope (explicit)

- No redesign of the page, header, cards, or table
- No changes to RLS, RBAC, or audit logging beyond reusing existing ones
- No new permission enum values (uses existing `adjust_stock`, `create_movements`, `manage_locations`, `manage_transfer_orders`)
- No barcode-printing for bins (separate feature)
- No bulk move; one product at a time

## Risk notes

- `bin_id` is nullable + new column → safe additive change; existing queries unaffected
- Hierarchy depth capped at 4 (UI enforces); recursive descendant lookup runs over a small in-memory tree (org-scoped)
- "Move Product" uses `transfer_orders` so existing per-location math is automatically correct without duplicating logic
