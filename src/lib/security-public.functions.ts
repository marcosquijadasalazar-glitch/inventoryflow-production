import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SECURITY_ACTIONS } from "./security-constants";

const PublicEventSchema = z.object({
  email: z.string().email().max(254).optional().nullable(),
  action: z.enum(SECURITY_ACTIONS),
  status: z.enum(["success", "failed", "info"]).default("info"),
  user_agent: z.string().max(2000).optional().nullable(),
});

export const logPublicSecurityEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PublicEventSchema.parse(input))
  .handler(async ({ data }) => {
    const { logSecurityEventServer } = await import("./security.server");
    await logSecurityEventServer({
      email: data.email ?? null,
      action: data.action,
      status: data.status,
      user_agent: data.user_agent ?? null,
    });
    return { ok: true as const };
  });