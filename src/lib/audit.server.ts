// Reusable audit helper for inserting operational events from server code
// (e.g. server functions or webhooks) when database triggers don't cover
// the action. Most events are captured by DB triggers — only call this for
// app-level actions not represented as a row mutation.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type OperationalAuditInput = {
  organization_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id?: string | null;
  entity_label?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  actor_user_id?: string | null;
  actor_email?: string | null;
};

export async function recordOperationalEvent(input: OperationalAuditInput) {
  const { error } = await (supabaseAdmin as any)
    .from("operational_audit_log")
    .insert({
      organization_id: input.organization_id,
      action_type: input.action_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      entity_label: input.entity_label ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ?? {},
      actor_user_id: input.actor_user_id ?? null,
      actor_email: input.actor_email ?? null,
    });
  if (error) console.error("[audit] failed to record event:", error.message);
}
