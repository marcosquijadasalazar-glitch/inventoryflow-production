# Granular RBAC Permissions

## Overview

Add a permission system layered on top of existing roles (`owner`, `manager`, `employee`, `super_admin`). Permissions are resolved as: **role defaults → org role overrides → per-user overrides**. Owners manage their org; super admins manage all orgs. Enforcement is both UI (hide) and server-side (block + RLS where applicable).

## Database

New migration:

1. **`app_permission` enum** with the 23 keys listed in the request.
2. **`role_permissions`** table — per-org role defaults.
   - `organization_id uuid`, `role app_role`, `permission app_permission`, `granted boolean`
   - Unique `(organization_id, role, permission)`. NULL `organization_id` = global defaults seed.
3. **`user_permissions`** table — per-user overrides.
   - `user_id uuid`, `organization_id uuid`, `permission app_permission`, `granted boolean`
   - Unique `(user_id, permission)`.
4. **`has_permission(_user_id uuid, _perm app_permission) returns boolean`** — security definer function. Resolves: super_admin → true; owner → true for own org; else user override → role override → hardcoded defaults from the spec.
5. **Seed defaults** for each existing organization based on the spec (Owner=all, Manager=specified subset, Employee=specified subset).
6. **RLS** on both tables: owners/managers can read/write their org's rows (and never `super_admin` role rows for owners); super_admin all access. Users can read their own `user_permissions`.
7. **Audit trigger** on both tables → insert into `admin_audit_log` with `action_type='permission_change'`.

## Server functions (`src/lib/permissions.functions.ts`)

- `getMyPermissions()` → returns `Record<AppPermission, boolean>` for current user (calls `has_permission` for each).
- `getOrgRolePermissions(orgId)` → matrix for the org.
- `getUserOverrides(orgId)` → all per-user overrides for the org.
- `setRolePermission({ orgId, role, permission, granted })` — owner-only, blocks `super_admin` role edits, blocks cross-org for non-super-admin.
- `setUserPermission({ userId, permission, granted | null })` — owner-only, same org check, blocks super_admin targets.
- All mutations validate caller via `requireSupabaseAuth` + role/org checks and write `admin_audit_log` entries.

## Client

- **`src/lib/use-permissions.ts`** — `usePermissions()` hook backed by React Query; exposes `can(perm)` helper.
- **`src/lib/permissions.ts`** — constants: `ALL_PERMISSIONS`, `DEFAULT_PERMISSIONS` per role, permission groups for UI.
- **Sidebar/nav (`src/components/AppLayout.tsx`)** — gate menu items by permission (in addition to existing module gates).
- **Route guard** — extend `_authenticated.tsx` with a `permissionForPath` map; block access with a "No permission" view when missing.
- **Action gating** — hide/disable create/edit/delete buttons and cost/price columns based on `can()` in: products, movements, orders, transfers, internal use, reports, exports, settings, alerts, locations, scanner.
- **Admin UI (`src/routes/_authenticated/admin.tsx`)** — new "Roles & Permissions" tab:
  - Role matrix: rows = permissions grouped by category, columns = roles, toggles per cell.
  - User overrides: pick a user → matrix of overrides (granted / denied / inherit).
  - Owners only see their org; super admin sees an org selector.

## i18n

Add `permissions.*` namespace to `en.json` and `es.json`: section titles, permission labels/descriptions, role names, "No permission" page copy, toast messages.

## Security guarantees

- Owners cannot grant `super_admin` role or edit users outside their org (enforced server-side + RLS).
- All writes go through server functions with role checks; UI gating is defense-in-depth, not the primary gate.
- Cost/price visibility is gated by `view_costs` / `view_prices` on the **read path** in product list/detail components — costs/prices are simply not rendered when the permission is missing. (Full column-level RLS for prices would require breaking the products table; out of scope.)
- Every permission change is logged in `admin_audit_log` with `target_type='role_permission' | 'user_permission'`, performer, before/after.

## Out of scope (kept working as-is)

Auth, signup, onboarding, plan limits, module gating, RLS on existing tables, trial logic, password reset flow.
