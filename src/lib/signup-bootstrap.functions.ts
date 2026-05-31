import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  plan: z.enum(["free", "starter", "pro"]),
  companyName: z.string().trim().min(1).max(200),
  businessType: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  fullName: z.string().trim().max(120).optional().nullable(),
});

export type BootstrapResult = {
  organizationId: string;
  plan: "free" | "starter" | "pro";
  pendingPlan: "starter" | "pro" | null;
  needsCheckout: boolean;
  alreadyExisted: boolean;
};

// Idempotent: provisions an organization for a fresh signup (or returns
// the existing one). Promotes the current user to owner and records the
// selected plan intent. Paid plans stay on plan_type='free' until the
// Stripe webhook confirms payment; pending_plan signals the dashboard
// to show the "payment required" gate.
export const bootstrapOrgForSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ context, data }): Promise<BootstrapResult> => {
    const userId = context.userId;
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, role, organization_id, full_name, company_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("Profile not found");

    const pendingPlan = data.plan === "free" ? null : data.plan;

    // Idempotent: already provisioned.
    if (profile.organization_id) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id, pending_plan, plan_type")
        .eq("id", profile.organization_id)
        .maybeSingle();
      console.info("[signup-bootstrap] reuse existing org", {
        userId,
        organizationId: profile.organization_id,
        plan: data.plan,
        existingPending: (org as any)?.pending_plan ?? null,
      });
      return {
        organizationId: profile.organization_id,
        plan: data.plan,
        pendingPlan: ((org as any)?.pending_plan as any) ?? null,
        needsCheckout: data.plan !== "free" && !!pendingPlan,
        alreadyExisted: true,
      };
    }

    // Create organization (plan_type=free until Stripe confirms paid plan).
    const { data: org, error: oErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        company_name: data.companyName,
        business_type: data.businessType ?? null,
        plan_type: "free" as never,
        pending_plan: pendingPlan,
        subscription_status: pendingPlan ? "pending_payment" : "active",
      } as never)
      .select("id")
      .single();
    if (oErr || !org) throw new Error(oErr?.message ?? "Failed to create organization");

    // Promote current user to owner; trial only for the free plan.
    const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const profilePatch: Record<string, unknown> = {
      role: "owner",
      organization_id: org.id,
      account_status: data.plan === "free" ? "trial_active" : "active",
      company_name: data.companyName,
      business_type: data.businessType ?? null,
      phone: data.phone ?? null,
      trial_ends_at: data.plan === "free" ? trialEnds : null,
    };
    if (data.fullName) profilePatch.full_name = data.fullName;

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update(profilePatch as never)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "org_bootstrap",
      target_type: "organization",
      target_id: org.id,
      target_label: data.companyName,
      performed_by: userId,
      performed_by_email: profile.email,
      metadata: {
        selected_plan: data.plan,
        pending_plan: pendingPlan,
      } as any,
    } as never);

    console.info("[signup-bootstrap] created org", {
      userId,
      organizationId: org.id,
      selectedPlan: data.plan,
      pendingPlan,
    });

    return {
      organizationId: org.id,
      plan: data.plan,
      pendingPlan,
      needsCheckout: !!pendingPlan,
      alreadyExisted: false,
    };
  });
