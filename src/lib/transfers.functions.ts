import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordOperationalEvent } from "@/lib/audit.server";
import { createNotification } from "@/lib/notifications.server";
import { buildTransferMovementRows } from "@/lib/transfer-movements";

const ItemSchema = z.object({
  product_id: z.string().uuid(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  product_name: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(1_000_000),
});

async function getCaller(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, full_name, role, organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.organization_id) throw new Error("No organization");
  return data as {
    user_id: string;
    email: string;
    full_name: string | null;
    role: string;
    organization_id: string;
  };
}

function genNumber(prefix: string) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  return `${prefix}-${stamp}`;
}

/**
 * Submit a transfer that requires approval.
 * - Creates transfer with status='pending_approval'
 * - Reserves stock (computed via product_reservations view; trigger-free reservation)
 * - Creates an approval_request linked via payload.transfer_id
 * - Notifies eligible approvers + the requester (status notification)
 */
export const submitTransferForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        from_location_id: z.string().uuid().nullable(),
        to_location_id: z.string().uuid().nullable(),
        from_location: z.string().min(1).max(200),
        to_location: z.string().min(1).max(200),
        transfer_date: z.string().nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        items: z.array(ItemSchema).min(1),
        reason: z.string().min(3).max(500),
        required_role: z.enum(["manager", "owner"]).default("manager"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);

    // Defense-in-depth: only employees may go through approval workflow.
    // Owners/managers/super_admin should execute transfers directly.
    if (["owner", "manager", "super_admin"].includes(me.role)) {
      throw new Error("Owners and managers do not require approval — create transfer directly.");
    }

    if (data.from_location_id && data.to_location_id && data.from_location_id === data.to_location_id) {
      throw new Error("Source and destination cannot be the same");
    }

    // LOCATION-AWARE available-stock check: subtract reservations at this source only.
    const itemsSnapshot: Array<{
      product_id: string;
      product_name: string | null;
      sku: string | null;
      requested_qty: number;
      on_hand: number;
      reserved_at_source: number;
      available_at_source: number;
    }> = [];
    for (const it of data.items) {
      const { data: p } = await supabaseAdmin
        .from("products")
        .select("id, name, stock")
        .eq("id", it.product_id)
        .maybeSingle();
      if (!p) throw new Error(`Product not found`);

      let reservedAtSource = 0;
      if (data.from_location_id) {
        const { data: rsv } = await supabaseAdmin
          .from("product_reservations" as never)
          .select("reserved_qty")
          .eq("product_id", it.product_id)
          .eq("organization_id", me.organization_id)
          .eq("from_location_id", data.from_location_id);
        reservedAtSource = ((rsv ?? []) as any[]).reduce((s, r) => s + Number(r.reserved_qty ?? 0), 0);
      }
      const onHand = Number((p as any).stock ?? 0);
      const available = onHand - reservedAtSource;
      if (available < it.quantity) {
        throw new Error(
          `Insufficient available stock for ${(p as any).name} at source: need ${it.quantity}, available ${Math.max(available, 0)} (on-hand ${onHand}, reserved at source ${reservedAtSource})`,
        );
      }
      itemsSnapshot.push({
        product_id: it.product_id,
        product_name: it.product_name ?? (p as any).name ?? null,
        sku: it.sku ?? null,
        requested_qty: it.quantity,
        on_hand: onHand,
        reserved_at_source: reservedAtSource,
        available_at_source: available,
      });
    }

    const transferNumber = genNumber("TR");

    const { data: tr, error: trErr } = await supabaseAdmin
      .from("transfer_orders" as never)
      .insert({
        transfer_number: transferNumber,
        organization_id: me.organization_id,
        from_location: data.from_location,
        to_location: data.to_location,
        from_location_id: data.from_location_id,
        to_location_id: data.to_location_id,
        transfer_date: data.transfer_date ?? new Date().toISOString().slice(0, 10),
        notes: data.notes ?? null,
        status: "pending_approval",
        requested_by: me.user_id,
      } as never)
      .select()
      .single();
    if (trErr) throw new Error(trErr.message);

    const trId = (tr as any).id as string;

    const { error: iErr } = await supabaseAdmin
      .from("transfer_order_items")
      .insert(
        data.items.map((i) => ({
          transfer_order_id: trId,
          product_id: i.product_id,
          sku: i.sku ?? null,
          barcode: i.barcode ?? null,
          product_name: i.product_name ?? null,
          quantity: i.quantity,
        })),
      );
    if (iErr) {
      // best-effort rollback
      await supabaseAdmin.from("transfer_orders").delete().eq("id", trId);
      throw new Error(iErr.message);
    }

    // Create approval request, linking transfer via payload
    const totalQty = data.items.reduce((s, i) => s + i.quantity, 0);
    const { data: req, error: aErr } = await supabaseAdmin
      .from("approval_requests" as never)
      .insert({
        organization_id: me.organization_id,
        action_type: "transfer_order",
        status: "pending",
        requested_by: me.user_id,
        requested_by_email: me.email,
        reason: data.reason,
        payload: {
          transfer_id: trId,
          transfer_number: transferNumber,
          from_location: data.from_location,
          to_location: data.to_location,
          from_location_id: data.from_location_id,
          to_location_id: data.to_location_id,
          items: data.items,
          items_snapshot: itemsSnapshot,
        },
        threshold_snapshot: { quantity: totalQty },
        entity_label: transferNumber,
        same_session: false,
      } as never)
      .select()
      .single();
    if (aErr) throw new Error(aErr.message);

    const requestId = (req as any).id as string;
    await supabaseAdmin
      .from("transfer_orders" as never)
      .update({ approval_request_id: requestId } as never)
      .eq("id", trId);

    // Notifications
    const requesterName = me.full_name?.trim() || me.email || "An employee";

    await createNotification({
      organization_id: me.organization_id,
      user_id: me.user_id,
      type: "system",
      title: "Transfer Submitted For Approval",
      message: `Your transfer request ${transferNumber} has been submitted. Status: Pending Approval`,
      entity_type: "transfer_order",
      entity_id: trId,
      action_path: "/movements?tab=transfers",
      metadata: { transfer_id: trId, role_context: "requester" },
    });

    const approverRoles: Array<"owner" | "manager"> =
      data.required_role === "owner" ? ["owner"] : ["owner", "manager"];
    const { data: approvers } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("organization_id", me.organization_id)
      .in("role", approverRoles)
      .neq("user_id", me.user_id);

    for (const a of (approvers ?? []) as Array<{ user_id: string }>) {
      await createNotification({
        organization_id: me.organization_id,
        user_id: a.user_id,
        type: "system",
        title: "Approval Required: Transfer",
        message: `${requesterName} requested approval for Transfer ${transferNumber} (${data.from_location} → ${data.to_location}, ${totalQty} units).`,
        entity_type: "approval_request",
        entity_id: requestId,
        action_path: "/settings?tab=approvals",
        metadata: {
          action_type: "transfer_order",
          transfer_id: trId,
          required_role: data.required_role,
          role_context: "approver",
          cta: "Review Request",
        },
      });
    }

    await recordOperationalEvent({
      organization_id: me.organization_id,
      action_type: "transfer_requested",
      entity_type: "transfer_order",
      entity_id: trId,
      entity_label: transferNumber,
      summary: `${me.email} submitted transfer ${transferNumber} for approval`,
      metadata: { transfer_id: trId, approval_request_id: requestId, total_qty: totalQty },
      actor_user_id: me.user_id,
      actor_email: me.email ?? undefined,
    });

    return { ok: true, transfer_id: trId, approval_request_id: requestId };
  });

/**
 * Complete an approved transfer: insert OUT + IN inventory movements, mark completed,
 * release reservation (automatic since status leaves pending_approval/approved).
 */
export const completeApprovedTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ transfer_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);

    const { data: tr, error } = await supabaseAdmin
      .from("transfer_orders" as never)
      .select("*")
      .eq("id", data.transfer_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tr) throw new Error("Transfer not found");
    const t = tr as any;
    if (t.organization_id !== me.organization_id && me.role !== "super_admin") {
      throw new Error("Forbidden");
    }
    if (t.status !== "approved") {
      throw new Error(`Transfer must be approved before completion (current: ${t.status})`);
    }
    const isRequester = t.requested_by === me.user_id;
    const isPriv = ["owner", "manager", "super_admin"].includes(me.role);
    if (!isRequester && !isPriv) throw new Error("Only the requester or a manager/owner can complete this transfer");

    if (!t.from_location_id || !t.to_location_id) {
      throw new Error("Source and destination locations are required to complete transfer");
    }

    const { data: items } = await supabaseAdmin
      .from("transfer_order_items")
      .select("*")
      .eq("transfer_order_id", t.id);

    for (const it of (items ?? []) as any[]) {
      if (!it.product_id || !it.quantity) continue;
      const noteOut = `[transfer-out] ${t.transfer_number} ${t.from_location} → ${t.to_location}`;
      const noteIn = `[transfer-in] ${t.transfer_number} ${t.from_location} → ${t.to_location}`;
      const [removeRow, addRow] = buildTransferMovementRows({
        product_id: it.product_id,
        quantity: it.quantity,
        from_location_id: t.from_location_id,
        to_location_id: t.to_location_id,
        noteOut,
        noteIn,
        organization_id: me.organization_id,
      });
      const { error: outErr } = await supabaseAdmin
        .from("inventory_movements")
        .insert(removeRow as never);
      if (outErr) throw new Error(outErr.message);
      const { error: inErr } = await supabaseAdmin
        .from("inventory_movements")
        .insert(addRow as never);
      if (inErr) throw new Error(inErr.message);
    }

    await supabaseAdmin
      .from("transfer_orders" as never)
      .update({
        status: "completed",
        completed_date: new Date().toISOString().slice(0, 10),
      } as never)
      .eq("id", t.id);

    await recordOperationalEvent({
      organization_id: t.organization_id,
      action_type: "transfer_completed",
      entity_type: "transfer_order",
      entity_id: t.id,
      entity_label: t.transfer_number,
      summary: `${me.email} completed transfer ${t.transfer_number}`,
      metadata: { transfer_id: t.id },
      actor_user_id: me.user_id,
      actor_email: me.email ?? undefined,
    });

    if (t.requested_by && t.requested_by !== me.user_id) {
      await createNotification({
        organization_id: t.organization_id,
        user_id: t.requested_by,
        type: "system",
        title: "Transfer Completed",
        message: `Transfer ${t.transfer_number} has been completed and inventory updated.`,
        entity_type: "transfer_order",
        entity_id: t.id,
        action_path: "/movements?tab=transfers",
        metadata: { transfer_id: t.id, role_context: "requester" },
      });
    }

    return { ok: true };
  });

/**
 * Cancel a transfer that is pending_approval or approved (releases reservation).
 * Requester or owner/manager only. Does not create movements.
 */
export const cancelTransferRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ transfer_id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);
    const { data: tr } = await supabaseAdmin
      .from("transfer_orders" as never)
      .select("*")
      .eq("id", data.transfer_id)
      .maybeSingle();
    if (!tr) throw new Error("Transfer not found");
    const t = tr as any;
    if (t.organization_id !== me.organization_id && me.role !== "super_admin") throw new Error("Forbidden");
    if (!["pending_approval", "approved", "draft"].includes(t.status)) {
      throw new Error(`Cannot cancel a ${t.status} transfer`);
    }
    const isRequester = t.requested_by === me.user_id;
    const isPriv = ["owner", "manager", "super_admin"].includes(me.role);
    if (!isRequester && !isPriv) throw new Error("Not allowed");

    await supabaseAdmin
      .from("transfer_orders" as never)
      .update({ status: "cancelled" } as never)
      .eq("id", t.id);

    // If linked to an approval request still pending, mark it as expired/rejected? Keep simple: leave alone.
    await recordOperationalEvent({
      organization_id: t.organization_id,
      action_type: "transfer_cancelled",
      entity_type: "transfer_order",
      entity_id: t.id,
      entity_label: t.transfer_number,
      summary: `${me.email} cancelled transfer ${t.transfer_number}`,
      metadata: { reason: data.reason ?? null },
      actor_user_id: me.user_id,
      actor_email: me.email ?? undefined,
    });

    return { ok: true };
  });

/**
 * Fetch a transfer along with items + reservation context. Used by approval queue
 * to render the full transfer package.
 */
export const getTransferPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ transfer_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);
    const { data: tr, error } = await supabaseAdmin
      .from("transfer_orders" as never)
      .select("*")
      .eq("id", data.transfer_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tr) return { transfer: null, items: [] };
    const t = tr as any;
    if (t.organization_id !== me.organization_id && me.role !== "super_admin") throw new Error("Forbidden");
    const { data: items } = await supabaseAdmin
      .from("transfer_order_items")
      .select("*")
      .eq("transfer_order_id", t.id);
    // Pull snapshot (on-hand / reserved / available at time of request) from the
    // linked approval request payload, if present.
    let snapshot: any[] = [];
    if (t.approval_request_id) {
      const { data: req } = await supabaseAdmin
        .from("approval_requests" as never)
        .select("payload")
        .eq("id", t.approval_request_id)
        .maybeSingle();
      snapshot = ((req as any)?.payload?.items_snapshot ?? []) as any[];
    }
    return { transfer: t, items: items ?? [], items_snapshot: snapshot };
  });

/**
 * Aggregate reserved quantity per product (for the caller's org).
 * Used by stock displays to show "Reserved" + "Available = stock - reserved".
 */
export const listReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getCaller(context.userId);
    const { data, error } = await supabaseAdmin
      .from("product_reservations" as never)
      .select("product_id, reserved_qty")
      .eq("organization_id", me.organization_id);
    if (error) throw new Error(error.message);
    // Aggregate across locations
    const map: Record<string, number> = {};
    for (const r of (data ?? []) as any[]) {
      map[r.product_id] = (map[r.product_id] ?? 0) + Number(r.reserved_qty ?? 0);
    }
    return { reserved: map };
  });
