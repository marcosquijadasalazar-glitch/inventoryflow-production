import { createMiddleware } from "@/integrations/supabase/create-middleware";
import type { Database } from "@/integrations/supabase/types";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async (options) => {
    const { next } = options;
    const request = (options as typeof options & { request?: Request }).request;
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) throw new Error("Missing authentication configuration");
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");
    const supabase = createClient<Database>(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) throw new Error("Unauthorized");
    const session = { supabase, userId: data.claims.sub, claims: data.claims };
    return next({ context: session });
  },
);