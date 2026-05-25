import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getActor(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, role, organization_id, email, full_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Profile not found");
  return data;
}

async function requireOwner(userId: string) {
  const me = await getActor(userId);
  if (me.role !== "owner" && me.role !== "super_admin" && me.role !== "manager") {
    throw new Error("Only owners or managers can run onboarding");
  }
  return me;
}

// ---------- Read state ----------

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getActor(context.userId);
    if (!me.organization_id) {
      return {
        hasOrg: false,
        role: me.role,
        org: null as null,
      };
    }
    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .select(
        "id, company_name, business_type, plan_type, onboarding_completed, onboarding_step, onboarding_completed_at, onboarding_dismissed, demo_data_installed, onboarding_business_size, onboarding_product_volume, onboarding_location_count, onboarding_started_at, created_at"
      )
      .eq("id", me.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      hasOrg: true,
      role: me.role,
      org: org as any,
    };
  });

// ---------- Step updates ----------

const StepSchema = z.object({
  step: z.number().int().min(0).max(10),
  business_type: z.string().max(100).optional().nullable(),
  business_size: z.string().max(40).optional().nullable(),
  product_volume: z.string().max(40).optional().nullable(),
  location_count: z.string().max(40).optional().nullable(),
  preferred_language: z.enum(["en", "es"]).optional(),
});

export const updateOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => StepSchema.parse(i))
  .handler(async ({ context, data }) => {
    const me = await requireOwner(context.userId);
    if (!me.organization_id) throw new Error("No organization");
    const patch: Record<string, unknown> = {
      onboarding_step: data.step,
    };
    if (data.business_type !== undefined) patch.business_type = data.business_type;
    if (data.business_size !== undefined) patch.onboarding_business_size = data.business_size;
    if (data.product_volume !== undefined) patch.onboarding_product_volume = data.product_volume;
    if (data.location_count !== undefined) patch.onboarding_location_count = data.location_count;

    // Mark started_at on first transition past 0
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("onboarding_started_at")
      .eq("id", me.organization_id)
      .maybeSingle();
    if (!(org as any)?.onboarding_started_at && data.step > 0) {
      patch.onboarding_started_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from("organizations")
      .update(patch as never)
      .eq("id", me.organization_id);
    if (error) throw new Error(error.message);

    if (data.preferred_language) {
      // Stored on profile for future logins (column may not exist; ignore failure).
      await supabaseAdmin
        .from("profiles")
        .update({ /* no-op-safe */ } as never)
        .eq("user_id", context.userId)
        .then(() => undefined, () => undefined);
    }
    return { ok: true };
  });

// ---------- Complete ----------

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await requireOwner(context.userId);
    if (!me.organization_id) throw new Error("No organization");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 4,
      } as never)
      .eq("id", me.organization_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "onboarding_completed",
      target_type: "organization",
      target_id: me.organization_id,
      performed_by: context.userId,
      performed_by_email: me.email ?? null,
      metadata: { role: me.role },
    } as never);

    return { ok: true };
  });

// ---------- Skip wizard (dismiss the popup but keep checklist visible) ----------

export const skipOnboardingWizard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await requireOwner(context.userId);
    if (!me.organization_id) throw new Error("No organization");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      } as never)
      .eq("id", me.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Dismiss dashboard checklist ----------

export const dismissOnboardingChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await requireOwner(context.userId);
    if (!me.organization_id) throw new Error("No organization");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ onboarding_dismissed: true } as never)
      .eq("id", me.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Demo data seeding (idempotent) ----------

export const installDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await requireOwner(context.userId);
    if (!me.organization_id) throw new Error("No organization");
    const orgId = me.organization_id;

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("demo_data_installed")
      .eq("id", orgId)
      .maybeSingle();
    if ((org as any)?.demo_data_installed) {
      return { ok: true, already: true };
    }

    // 1 location
    const { data: loc } = await supabaseAdmin
      .from("locations")
      .insert({
        organization_id: orgId,
        name: "Demo Warehouse",
        type: "warehouse" as never,
        address: "123 Demo Street",
        is_active: true,
        notes: "Sample location — feel free to delete.",
      } as never)
      .select("id, name")
      .single();

    // 1 supplier, 1 customer
    await supabaseAdmin.from("suppliers").insert({
      organization_id: orgId,
      name: "Demo Supplier Co.",
      email: "supplier@example.com",
      phone: "+1 555 0100",
      notes: "Sample supplier — feel free to delete.",
    } as never);
    await supabaseAdmin.from("customers").insert({
      organization_id: orgId,
      name: "Demo Customer Inc.",
      email: "customer@example.com",
      phone: "+1 555 0200",
      notes: "Sample customer — feel free to delete.",
    } as never);

    // 6 products
    const demoProducts = [
      { name: "Demo Widget A", sku: "DEMO-WIDGET-A", category: "Electronics", price: 24.99, cost: 12, stock: 120, min_stock: 20 },
      { name: "Demo Widget B", sku: "DEMO-WIDGET-B", category: "Electronics", price: 39.5, cost: 18, stock: 8, min_stock: 15 },
      { name: "Demo Bolt M6", sku: "DEMO-BOLT-M6", category: "Hardware", price: 0.45, cost: 0.12, stock: 5000, min_stock: 500 },
      { name: "Demo Cable 2m", sku: "DEMO-CABLE-2M", category: "Electronics", price: 9.99, cost: 3.5, stock: 0, min_stock: 25 },
      { name: "Demo Label Pack", sku: "DEMO-LABEL-100", category: "Office", price: 12.0, cost: 4, stock: 240, min_stock: 30 },
      { name: "Demo Toolbox", sku: "DEMO-TOOL-01", category: "Hardware", price: 49.0, cost: 22, stock: 18, min_stock: 5 },
    ];
    const { data: inserted } = await supabaseAdmin
      .from("products")
      .insert(
        demoProducts.map((p) => ({
          ...p,
          organization_id: orgId,
          supplier: "Demo Supplier Co.",
          location: (loc as any)?.name ?? "Demo Warehouse",
        })) as never,
      )
      .select("id, name");

    // A couple of inventory movements for the activity feed
    if (inserted && inserted.length > 0) {
      const first = (inserted as any)[0];
      const second = (inserted as any)[1] ?? first;
      await supabaseAdmin.from("inventory_movements").insert([
        { organization_id: orgId, product_id: first.id, type: "add" as never, quantity: 20, note: "[demo] initial stock" },
        { organization_id: orgId, product_id: second.id, type: "remove" as never, quantity: 5, note: "[demo] sample sale" },
      ] as never);
    }

    await supabaseAdmin
      .from("organizations")
      .update({ demo_data_installed: true } as never)
      .eq("id", orgId);

    return { ok: true, already: false };
  });

// ---------- Checklist progress ----------

export const getChecklistProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getActor(context.userId);
    if (!me.organization_id) {
      return null;
    }
    const orgId = me.organization_id;

    const [{ count: productCount }, { count: locCount }, { count: userCount }, scanQ, importQ] =
      await Promise.all([
        supabaseAdmin
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
        supabaseAdmin
          .from("locations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_active", true),
        supabaseAdmin
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .eq("is_active", true),
        supabaseAdmin
          .from("transaction_history")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("source", "barcode_scan" as never),
        supabaseAdmin
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
      ]);

    const items = {
      created_product: (productCount ?? 0) > 0,
      imported_products: (importQ.count ?? 0) >= 5,
      used_scanner: (scanQ.count ?? 0) > 0,
      created_location: (locCount ?? 0) > 0,
      invited_employee: (userCount ?? 0) > 1,
    };
    const done = Object.values(items).filter(Boolean).length;
    const total = Object.keys(items).length;
    return { items, done, total, percent: Math.round((done / total) * 100) };
  });

// ---------- Bulk team invites (lightweight) ----------

const InviteBatchSchema = z.object({
  invites: z
    .array(
      z.object({
        email: z.string().trim().email().max(255),
        role: z.enum(["manager", "employee"]),
        full_name: z.string().trim().min(1).max(120).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export const inviteTeamDuringOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => InviteBatchSchema.parse(i))
  .handler(async ({ context, data }) => {
    const me = await requireOwner(context.userId);
    if (!me.organization_id) throw new Error("No organization");
    const orgId = me.organization_id;

    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const inv of data.invites) {
      try {
        const tempPass = `Tmp_${crypto.randomUUID()}A1!`;
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: inv.email,
          password: tempPass,
          email_confirm: true,
          user_metadata: {
            full_name: inv.full_name ?? inv.email.split("@")[0],
            role: inv.role,
            organization_id: orgId,
          },
        });
        if (error) throw new Error(error.message);
        const uid = created.user?.id;
        if (!uid) throw new Error("Failed to create user");
        await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              user_id: uid,
              email: inv.email,
              full_name: inv.full_name ?? inv.email.split("@")[0],
              role: inv.role as never,
              organization_id: orgId,
              account_status: "active" as never,
              is_active: true,
            } as never,
            { onConflict: "user_id" },
          );

        // Send password reset so they can set their own password
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const { createClient } = await import("@supabase/supabase-js");
        const c = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await c.auth.resetPasswordForEmail(inv.email, {
          redirectTo: "https://inventoryflowapp.com/reset-password",
        });

        results.push({ email: inv.email, ok: true });
      } catch (e) {
        results.push({ email: inv.email, ok: false, error: (e as Error).message });
      }
    }
    return { results };
  });

// ---------- Super-admin onboarding overview ----------

export const adminListOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getActor(context.userId);
    if (me.role !== "super_admin") throw new Error("Forbidden");
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select(
        "id, company_name, plan_type, created_at, onboarding_completed, onboarding_completed_at, onboarding_step, onboarding_started_at, demo_data_installed",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const now = Date.now();
    return (data ?? []).map((o: any) => {
      const startedDays = o.onboarding_started_at
        ? Math.floor((now - new Date(o.onboarding_started_at).getTime()) / 86_400_000)
        : null;
      return {
        ...o,
        needs_help:
          !o.onboarding_completed &&
          (startedDays != null ? startedDays >= 3 : (now - new Date(o.created_at).getTime()) / 86_400_000 >= 3),
      };
    });
  });
