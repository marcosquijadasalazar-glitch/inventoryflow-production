import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordOperationalEvent } from "@/lib/audit.server";
import { createNotification } from "@/lib/notifications.server";

const ACTIONS = [
  "stock_adjustment",
  "transfer_order",
  "product_deletion",
  "role_change",
  "large_import",
] as const;
const ActionEnum = z.enum(ACTIONS);
const RoleEnum = z.enum(["manager", "owner"]);

async function getCaller(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, role, organization_id, full_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.organization_id) throw new Error("No organization");
  return data as {
    user_id: string;
    email: string;
    role: string;
    organization_id: string;
    full_name: string | null;
  };
}

function canConfigure(role: string | null | undefined) {
  return role === "owner" || role === "manager" || role === "super_admin";
}

function canDecide(role: string | null | undefined, required: "manager" | "owner") {
  if (role === "super_admin" || role === "owner") return true;
  if (required === "manager" && role === "manager") return true;
  return false;
}

/** Sync linked transfer when an approval is decided, cancelled, or deleted. */
async function syncLinkedTransfer(
  req: { action_type: string; payload?: { transfer_id?: string } | null },
  outcome: "approved" | "rejected" | "cancelled",
  meta?: { actorUserId?: string; decisionNote?: string | null; now?: string },
) {
  if (req.action_type !== "transfer_order") return;
  const transferId = req.payload?.transfer_id;
  if (!transferId) return;

  const { data: tr } = await supabaseAdmin
    .from("transfer_orders" as never)
    .select("id, status")
    .eq("id", transferId)
    .maybeSingle();
  if (!tr) return;
  const t = tr as { id: string; status: string };
  const now = meta?.now ?? new Date().toISOString();

  if (outcome === "approved") {
    if (t.status !== "pending_approval") return;
    await supabaseAdmin
      .from("transfer_orders" as never)
      .update({
        status: "approved",
        approved_by: meta?.actorUserId ?? null,
        approved_at: now,
      } as never)
      .eq("id", transferId);
    return;
  }

  if (!["pending_approval", "approved"].includes(t.status)) return;

  if (outcome === "rejected") {
    await supabaseAdmin
      .from("transfer_orders" as never)
      .update({
        status: "rejected",
        rejected_at: now,
        rejection_reason: meta?.decisionNote ?? null,
      } as never)
      .eq("id", transferId);
    return;
  }

  await supabaseAdmin
    .from("transfer_orders" as never)
    .update({ status: "cancelled" } as never)
    .eq("id", transferId);
}

// ---------------- Policies ----------------

export const listApprovalPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getCaller(context.userId);
    const { data, error } = await supabaseAdmin
      .from("approval_policies" as never)
      .select("*")
      .eq("organization_id", me.organization_id);
    if (error) throw new Error(error.message);
    return { policies: data ?? [], canConfigure: canConfigure(me.role) };
  });

export const upsertApprovalPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        action_type: ActionEnum,
        enabled: z.boolean(),
        threshold_qty: z.number().int().min(0).nullable().optional(),
        threshold_value: z.number().min(0).nullable().optional(),
        required_role: RoleEnum,
        block_completely: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);
    if (!canConfigure(me.role)) throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("approval_policies" as never)
      .upsert(
        {
          organization_id: me.organization_id,
          action_type: data.action_type,
          enabled: data.enabled,
          threshold_qty: data.threshold_qty ?? null,
          threshold_value: data.threshold_value ?? null,
          required_role: data.required_role,
          block_completely: data.block_completely,
        } as never,
        { onConflict: "organization_id,action_type" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Same-session supervisor verify + approve ----------------

export const verifySupervisorAndApprove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        action_type: ActionEnum,
        supervisor_email: z.string().email().max(255),
        supervisor_password: z.string().min(1).max(200),
        reason: z.string().min(3).max(500),
        payload: z.record(z.string(), z.any()).default({}),
        entity_label: z.string().max(200).optional(),
        threshold_snapshot: z.record(z.string(), z.any()).default({}),
        required_role: RoleEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);

    // Block check
    const { data: pol } = await supabaseAdmin
      .from("approval_policies" as never)
      .select("*")
      .eq("organization_id", me.organization_id)
      .eq("action_type", data.action_type)
      .maybeSingle();
    if (pol && (pol as any).block_completely) {
      throw new Error("This action is blocked by company policy. Contact an owner or manager.");
    }

    // Re-auth supervisor in a transient client
    const { createClient } = await import("@supabase/supabase-js");
    const tmp = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: signIn, error: signErr } = await tmp.auth.signInWithPassword({
      email: data.supervisor_email,
      password: data.supervisor_password,
    });
    if (signErr || !signIn?.user) {
      throw new Error("Invalid supervisor credentials");
    }
    // Sign out immediately so the temp client doesn't keep the token around
    try { await tmp.auth.signOut(); } catch {}

    const sup = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, role, organization_id, full_name")
      .eq("user_id", signIn.user.id)
      .maybeSingle();
    if (sup.error || !sup.data) throw new Error("Supervisor profile not found");
    if (sup.data.organization_id !== me.organization_id && sup.data.role !== "super_admin") {
      throw new Error("Supervisor must belong to your organization");
    }
    if (!canDecide(sup.data.role, data.required_role)) {
      throw new Error(`Supervisor must be ${data.required_role} or owner`);
    }
    if (sup.data.user_id === me.user_id) {
      throw new Error("Supervisor must be a different user");
    }

    // Log the approved request
    const now = new Date().toISOString();
    const { data: row, error: insErr } = await supabaseAdmin
      .from("approval_requests" as never)
      .insert({
        organization_id: me.organization_id,
        action_type: data.action_type,
        status: "approved",
        requested_by: me.user_id,
        requested_by_email: me.email,
        approved_by: sup.data.user_id,
        approved_by_email: sup.data.email,
        reason: data.reason,
        payload: data.payload,
        threshold_snapshot: data.threshold_snapshot,
        entity_label: data.entity_label ?? null,
        same_session: true,
        decided_at: now,
      } as never)
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    await recordOperationalEvent({
      organization_id: me.organization_id,
      action_type: "approval_granted",
      entity_type: "approval_request",
      entity_id: (row as any).id,
      entity_label: data.entity_label ?? data.action_type,
      summary: `${sup.data.email} approved ${data.action_type} for ${me.email}: ${data.reason}`,
      metadata: {
        action_type: data.action_type,
        requested_by: me.email,
        approved_by: sup.data.email,
        reason: data.reason,
        same_session: true,
        threshold_snapshot: data.threshold_snapshot,
      },
      actor_user_id: sup.data.user_id,
      actor_email: sup.data.email ?? undefined,
    });

    return { ok: true, requestId: (row as any).id };
  });

// ---------------- Async request (queue) ----------------

export const submitApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        action_type: ActionEnum,
        reason: z.string().min(3).max(500),
        payload: z.record(z.string(), z.any()).default({}),
        entity_label: z.string().max(200).optional(),
        threshold_snapshot: z.record(z.string(), z.any()).default({}),
        required_role: RoleEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);

    const { data: pol } = await supabaseAdmin
      .from("approval_policies" as never)
      .select("*")
      .eq("organization_id", me.organization_id)
      .eq("action_type", data.action_type)
      .maybeSingle();
    if (pol && (pol as any).block_completely) {
      throw new Error("This action is blocked by company policy.");
    }

    const { data: row, error } = await supabaseAdmin
      .from("approval_requests" as never)
      .insert({
        organization_id: me.organization_id,
        action_type: data.action_type,
        status: "pending",
        requested_by: me.user_id,
        requested_by_email: me.email,
        reason: data.reason,
        payload: data.payload,
        threshold_snapshot: data.threshold_snapshot,
        entity_label: data.entity_label ?? null,
        same_session: false,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);

    await createNotification({
      organization_id: me.organization_id,
      type: "system",
      title: "Approval requested",
      message: `${me.email ?? "A user"} requested approval for ${data.action_type}: ${data.reason}`,
      entity_type: "approval_request",
      entity_id: (row as any).id as string,
      action_path: "/settings?tab=approvals",
      metadata: { action_type: data.action_type, required_role: data.required_role },
    });

    return { ok: true, requestId: (row as any).id };
  });

export const decideApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        request_id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        decision_note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);
    if (!canConfigure(me.role)) throw new Error("Forbidden");

    const { data: req, error: rErr } = await supabaseAdmin
      .from("approval_requests" as never)
      .select("*")
      .eq("id", data.request_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!req) throw new Error("Request not found");
    if ((req as any).deleted_at) throw new Error("Request not found");
    if ((req as any).organization_id !== me.organization_id && me.role !== "super_admin") {
      throw new Error("Forbidden");
    }
    if ((req as any).status !== "pending") throw new Error("Already decided");
    if ((req as any).requested_by === me.user_id) {
      throw new Error("You cannot decide your own approval request");
    }

    const now = new Date().toISOString();

    if (data.decision === "approved") {
      await syncLinkedTransfer(req as any, "approved", {
        actorUserId: me.user_id,
        now,
      });
    } else {
      await syncLinkedTransfer(req as any, "rejected", {
        decisionNote: data.decision_note ?? null,
        now,
      });
    }

    const { error: uErr } = await supabaseAdmin
      .from("approval_requests" as never)
      .update({
        status: data.decision,
        approved_by: me.user_id,
        approved_by_email: me.email,
        decision_note: data.decision_note ?? null,
        decided_at: now,
      } as never)
      .eq("id", data.request_id);
    if (uErr) throw new Error(uErr.message);

    await recordOperationalEvent({
      organization_id: (req as any).organization_id,
      action_type: data.decision === "approved" ? "approval_granted" : "approval_rejected",
      entity_type: "approval_request",
      entity_id: data.request_id,
      entity_label: (req as any).entity_label ?? (req as any).action_type,
      summary: `${me.email} ${data.decision} ${(req as any).action_type} requested by ${(req as any).requested_by_email}`,
      metadata: {
        action_type: (req as any).action_type,
        decision: data.decision,
        decision_note: data.decision_note,
      },
      actor_user_id: me.user_id,
      actor_email: me.email ?? undefined,
    });

    if ((req as any).requested_by) {
      await createNotification({
        organization_id: (req as any).organization_id,
        user_id: (req as any).requested_by,
        type: "system",
        title: data.decision === "approved" ? "Approval approved" : "Approval rejected",
        message: `Your request for ${(req as any).action_type} was ${data.decision} by ${me.email}.`,
        entity_type: "approval_request",
        entity_id: data.request_id,
        action_path: "/settings?tab=approvals",
        metadata: { decision: data.decision },
      });
    }

    return { ok: true };
  });

export const cancelApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ request_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);

    const { data: req, error: rErr } = await supabaseAdmin
      .from("approval_requests" as never)
      .select("*")
      .eq("id", data.request_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!req) throw new Error("Request not found");
    if ((req as any).organization_id !== me.organization_id && me.role !== "super_admin") {
      throw new Error("Forbidden");
    }
    if ((req as any).status !== "pending") throw new Error("Only pending requests can be cancelled");
    if ((req as any).requested_by !== me.user_id) {
      throw new Error("Only the requester can cancel this request");
    }

    await syncLinkedTransfer(req as any, "cancelled");

    const now = new Date().toISOString();
    const { error: uErr } = await supabaseAdmin
      .from("approval_requests" as never)
      .update({
        status: "cancelled",
        decided_at: now,
        decision_note: "Cancelled by requester",
      } as never)
      .eq("id", data.request_id);
    if (uErr) throw new Error(uErr.message);

    await recordOperationalEvent({
      organization_id: (req as any).organization_id,
      action_type: "approval_cancelled",
      entity_type: "approval_request",
      entity_id: data.request_id,
      entity_label: (req as any).entity_label ?? (req as any).action_type,
      summary: `${me.email} cancelled ${(req as any).action_type} approval request`,
      metadata: {
        action_type: (req as any).action_type,
        requested_by: (req as any).requested_by_email,
        transfer_id: (req as any).payload?.transfer_id ?? null,
      },
      actor_user_id: me.user_id,
      actor_email: me.email ?? undefined,
    });

    return { ok: true };
  });

export const deleteApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ request_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);
    if (!canConfigure(me.role)) throw new Error("Forbidden");

    const { data: req, error: rErr } = await supabaseAdmin
      .from("approval_requests" as never)
      .select("*")
      .eq("id", data.request_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!req) throw new Error("Request not found");
    if ((req as any).organization_id !== me.organization_id && me.role !== "super_admin") {
      throw new Error("Forbidden");
    }
    if ((req as any).status !== "pending") throw new Error("Only pending requests can be deleted");

    await syncLinkedTransfer(req as any, "cancelled");

    const now = new Date().toISOString();
    const { error: uErr } = await supabaseAdmin
      .from("approval_requests" as never)
      .update({
        deleted_at: now,
        deleted_by: me.user_id,
      } as never)
      .eq("id", data.request_id);
    if (uErr) throw new Error(uErr.message);

    await recordOperationalEvent({
      organization_id: (req as any).organization_id,
      action_type: "approval_deleted",
      entity_type: "approval_request",
      entity_id: data.request_id,
      entity_label: (req as any).entity_label ?? (req as any).action_type,
      summary: `${me.email} deleted ${(req as any).action_type} approval request from queue`,
      metadata: {
        action_type: (req as any).action_type,
        requested_by: (req as any).requested_by_email,
        transfer_id: (req as any).payload?.transfer_id ?? null,
      },
      actor_user_id: me.user_id,
      actor_email: me.email ?? undefined,
    });

    return { ok: true };
  });

export const listApprovalRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: z.enum(["pending", "approved", "rejected", "expired", "cancelled", "all"]).default("pending"),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const me = await getCaller(context.userId);

    // Mark expired (lazy, no cron needed)
    await supabaseAdmin
      .from("approval_requests" as never)
      .update({ status: "expired" } as never)
      .eq("organization_id", me.organization_id)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    let q = supabaseAdmin
      .from("approval_requests" as never)
      .select("*")
      .eq("organization_id", me.organization_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      requests: rows ?? [],
      canDecide: canConfigure(me.role),
      canDelete: canConfigure(me.role),
      currentUserId: me.user_id,
    };
  });

// ---------------- Analytics ----------------

export const approvalAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getCaller(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("approval_requests" as never)
      .select("action_type, status, created_at, threshold_snapshot, entity_label, requested_by_email")
      .eq("organization_id", me.organization_id)
      .is("deleted_at", null)
      .gte("created_at", new Date(Date.now() - 90 * 86400_000).toISOString())
      .limit(1000);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as any[];
    const byActionApproved: Record<string, number> = {};
    const byActionRejected: Record<string, number> = {};
    let total = 0, approved = 0, rejected = 0, pending = 0, expired = 0, cancelled = 0;
    const highRisk: any[] = [];

    for (const r of list) {
      total++;
      if (r.status === "approved") {
        approved++;
        byActionApproved[r.action_type] = (byActionApproved[r.action_type] ?? 0) + 1;
      } else if (r.status === "rejected") {
        rejected++;
        byActionRejected[r.action_type] = (byActionRejected[r.action_type] ?? 0) + 1;
      } else if (r.status === "pending") pending++;
      else if (r.status === "expired") expired++;
      else if (r.status === "cancelled") cancelled++;

      const v = Number(r.threshold_snapshot?.value ?? 0);
      const q = Number(r.threshold_snapshot?.quantity ?? 0);
      if (v >= 5000 || q >= 500) highRisk.push(r);
    }

    return {
      totals: { total, approved, rejected, pending, expired, cancelled },
      mostApproved: Object.entries(byActionApproved).sort((a, b) => b[1] - a[1]).slice(0, 5),
      mostRejected: Object.entries(byActionRejected).sort((a, b) => b[1] - a[1]).slice(0, 5),
      highRisk: highRisk.slice(0, 10),
      canConfigure: canConfigure(me.role),
    };
  });
