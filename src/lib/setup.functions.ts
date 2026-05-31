import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./security-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getSetupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (error) throw new Error(error.message);
    const superAdminExists = (count ?? 0) > 0;

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("role, email")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      superAdminExists,
      isSuperAdmin: me?.role === "super_admin",
      email: me?.email ?? null,
    };
  });

export const claimSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Atomic guard: only promote if no super_admin exists yet.
    const { count, error: cErr } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) {
      throw new Error("Setup already completed: a super admin already exists.");
    }

    // Ensure profile exists for current user, then promote.
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await supabaseAdmin.from("profiles").insert({
        user_id: context.userId,
        role: "super_admin",
      });
      if (insErr) throw new Error(insErr.message);
    } else {
      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({ role: "super_admin" })
        .eq("user_id", context.userId);
      if (upErr) throw new Error(upErr.message);
    }

    return { ok: true };
  });
