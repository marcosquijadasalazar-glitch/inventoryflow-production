import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ProfileSchema = z.object({
  company_name: z.string().trim().max(200).nullable().optional(),
  logo_url: z.string().trim().max(2000).url().nullable().optional().or(z.literal("")),
  business_type: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().max(255).email().nullable().optional().or(z.literal("")),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  timezone: z.string().trim().max(80).nullable().optional(),
  currency: z.string().trim().max(10).nullable().optional(),
  tax_id: z.string().trim().max(80).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  footer_notes: z.string().trim().max(1000).nullable().optional(),
});

async function getActor(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, role, organization_id, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Profile not found");
  return data;
}

function resolveTargetOrg(actor: { role: string; organization_id: string | null }, requested?: string | null) {
  if (actor.role === "super_admin") {
    if (!requested) throw new Error("organizationId required for super admin");
    return requested;
  }
  if (!actor.organization_id) throw new Error("No organization");
  if (requested && requested !== actor.organization_id) {
    throw new Error("Cross-organization action is not allowed");
  }
  return actor.organization_id;
}

export const getCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const actor = await getActor(context.userId);
    const orgId = resolveTargetOrg(actor, data.organizationId ?? null);

    let { data: row, error } = await supabaseAdmin
      .from("company_settings")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!row) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("company_name, business_type")
        .eq("id", orgId)
        .maybeSingle();
      const ins = await supabaseAdmin
        .from("company_settings")
        .insert({
          organization_id: orgId,
          company_name: org?.company_name ?? null,
          business_type: org?.business_type ?? null,
        })
        .select("*")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      row = ins.data;
    }
    return {
      profile: row,
      canEdit: actor.role === "super_admin" || actor.role === "owner",
      canEditRestricted: actor.role === "super_admin",
      actorRole: actor.role,
    };
  });

// Fields an organization owner is allowed to edit on their company profile.
// Super Admins can edit all fields. Anyone else cannot edit at all.
const OWNER_ALLOWED_FIELDS = new Set([
  "phone",
  "email",
  "website",
  "address",
  "city",
  "country",
  "logo_url",
  "footer_notes",
]);

async function notifySuperAdminsOfOwnerEdit(opts: {
  organizationId: string;
  companyName: string | null;
  changed: Record<string, { from: unknown; to: unknown }>;
  actorEmail: string | null;
  actorName: string | null;
}) {
  if (Object.keys(opts.changed).length === 0) return;

  // Pull super-admin recipients
  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("role", "super_admin");
  const adminEmails = Array.from(
    new Set(
      (admins ?? [])
        .map((a: any) => a.email as string | null)
        .filter((e): e is string => !!e),
    ),
  );
  const fallback = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
  if (adminEmails.length === 0 && fallback) adminEmails.push(fallback);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || adminEmails.length === 0) {
    console.log(
      `[company-profile] owner edited org ${opts.organizationId} (${opts.companyName}); admin email skipped (not configured)`,
    );
    return;
  }

  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
  const fmt = (v: unknown) =>
    v === null || v === undefined || v === "" ? "—" : esc(String(v));

  const rows = Object.entries(opts.changed)
    .map(
      ([field, { from, to }]) =>
        `<tr><td style="padding:8px 12px;background:#f7f7f9;border:1px solid #eee;font-weight:600">${esc(field)}</td><td style="padding:8px 12px;border:1px solid #eee;color:#888">${fmt(from)}</td><td style="padding:8px 12px;border:1px solid #eee">${fmt(to)}</td></tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 8px">Company profile updated</h2>
      <p style="margin:0 0 16px;color:#555">
        <strong>${esc(opts.companyName ?? "—")}</strong> was edited by
        ${esc(opts.actorName ?? opts.actorEmail ?? "an owner")} on ${new Date().toISOString()}.
      </p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:8px 12px;background:#eee;border:1px solid #ddd">Field</th>
          <th style="text-align:left;padding:8px 12px;background:#eee;border:1px solid #ddd">Old value</th>
          <th style="text-align:left;padding:8px 12px;background:#eee;border:1px solid #ddd">New value</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#888;font-size:12px;margin-top:24px">InventoryFlow audit notification.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "InventoryFlow <onboarding@resend.dev>",
        to: adminEmails,
        subject: `Company profile updated: ${opts.companyName ?? opts.organizationId}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[company-profile] Resend failed [${res.status}]: ${await res.text()}`);
    }
  } catch (e: any) {
    console.error("[company-profile] notify error:", e?.message ?? e);
  }
}

export const updateCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      organizationId: z.string().uuid().nullable().optional(),
      values: ProfileSchema,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await getActor(context.userId);
    if (actor.role !== "super_admin" && actor.role !== "owner") {
      throw new Error("Forbidden: owner role required");
    }
    const orgId = resolveTargetOrg(actor, data.organizationId ?? null);

    // Normalize empty strings to null
    const v: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(data.values)) {
      v[k] = typeof val === "string" && val.trim() === "" ? null : val;
    }

    // Owners can only edit a restricted subset; silently strip anything else.
    if (actor.role === "owner") {
      for (const k of Object.keys(v)) {
        if (!OWNER_ALLOWED_FIELDS.has(k)) delete v[k];
      }
    }

    // Find existing row
    const existing = await supabaseAdmin
      .from("company_settings")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    let updated;
    if (existing.data) {
      const upd = await supabaseAdmin
        .from("company_settings")
        .update({ ...v, updated_at: new Date().toISOString() })
        .eq("id", existing.data.id)
        .select("*")
        .single();
      if (upd.error) throw new Error(upd.error.message);
      updated = upd.data;
    } else {
      const ins = await supabaseAdmin
        .from("company_settings")
        .insert({ organization_id: orgId, ...v })
        .select("*")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      updated = ins.data;
    }

    // Mirror company_name/business_type to organizations for consistency
    // (only super_admin can change these since owners had them stripped above).
    if (typeof v.company_name === "string" && v.company_name) {
      await supabaseAdmin
        .from("organizations")
        .update({
          company_name: v.company_name as string,
          business_type: (v.business_type as string) ?? null,
        })
        .eq("id", orgId);
    }

    // Compute change set
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    if (existing.data) {
      for (const k of Object.keys(v)) {
        const before = (existing.data as Record<string, unknown>)[k] ?? null;
        const after = v[k] ?? null;
        if (before !== after) changed[k] = { from: before, to: after };
      }
    } else {
      for (const k of Object.keys(v)) changed[k] = { from: null, to: v[k] ?? null };
    }

    const { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("company_name")
      .eq("id", orgId)
      .maybeSingle();

    await supabaseAdmin.from("admin_audit_log").insert({
      action_type:
        actor.role === "owner" ? "company_profile_update_by_owner" : "company_profile_update",
      target_type: "organization",
      target_id: orgId,
      target_label: orgRow?.company_name ?? null,
      performed_by: context.userId,
      performed_by_email: actor.email,
      metadata: { changed, actor_role: actor.role } as any,
    });

    if (actor.role === "owner" && Object.keys(changed).length > 0) {
      await notifySuperAdminsOfOwnerEdit({
        organizationId: orgId,
        companyName: orgRow?.company_name ?? null,
        changed,
        actorEmail: actor.email,
        actorName: null,
      });
    }

    return { profile: updated };
  });
