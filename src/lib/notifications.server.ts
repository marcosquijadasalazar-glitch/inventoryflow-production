import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificationType =
  | "low_stock"
  | "transfer_received"
  | "suspicious_activity"
  | "onboarding_incomplete"
  | "payment_failed"
  | "trial_ending"
  | "user_created"
  | "role_changed"
  | "system";

// Safe deep-link path: must be a same-origin app path that starts with a single "/".
// Protects against javascript:, protocol-relative ("//evil.com"), and full URLs.
function sanitizePath(p?: string | null): string | null {
  if (!p) return null;
  if (typeof p !== "string") return null;
  if (!p.startsWith("/")) return null;
  if (p.startsWith("//")) return null;
  if (p.length > 512) return null;
  return p;
}

export async function createNotification(input: {
  organization_id: string;
  user_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  action_path?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("notifications" as never).insert({
    organization_id: input.organization_id,
    user_id: input.user_id ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    action_path: sanitizePath(input.action_path),
    metadata: input.metadata ?? {},
  } as never);
  if (error) console.error("[notifications] insert failed", error);
}
