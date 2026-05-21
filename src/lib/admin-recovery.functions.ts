import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CONFIRMATION_PHRASE = "MAKE ME SUPER ADMIN";

const RecoverySchema = z.object({
  confirmation: z.literal(CONFIRMATION_PHRASE),
});

export const recoverSuperAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecoverySchema.parse(input))
  .handler(async ({ context }) => {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (authError) throw new Error(authError.message);

    const email = authUser.user?.email ?? null;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: context.userId,
          email,
          role: "super_admin",
        },
        { onConflict: "user_id" },
      );
    if (profileError) throw new Error(profileError.message);

    const { error: logError } = await supabaseAdmin.from("transaction_history").insert({
      type: "stock_adjusted",
      source: "system",
      user_id: context.userId,
      user_email: email,
      reason: `SECURITY AUDIT: Temporary /admin-recovery promoted user ${context.userId} (${email ?? "unknown email"}) to super_admin.`,
    });
    if (logError) throw new Error(logError.message);

    return { ok: true };
  });
