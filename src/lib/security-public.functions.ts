import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { SECURITY_ACTIONS } from "./security-constants";

const PublicEventSchema = z.object({
  email: z.string().email().max(254).optional().nullable(),
  action: z.enum(SECURITY_ACTIONS),
  status: z.enum(["success", "failed", "info"]).default("info"),
  user_agent: z.string().max(2000).optional().nullable(),
  device_fingerprint: z.string().max(128).optional().nullable(),
  reason: z.string().max(120).optional().nullable(),
});

export const logPublicSecurityEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PublicEventSchema.parse(input))
  .handler(async ({ data }) => {
    const { logSecurityEventServer, getClientIp } = await import("./security.server");
    const ip = getClientIp(getRequest()?.headers ?? null);
    await logSecurityEventServer({
      email: data.email ?? null,
      action: data.action,
      status: data.status,
      user_agent: data.user_agent ?? null,
      ip_address: ip,
      device_fingerprint: data.device_fingerprint ?? null,
      details: data.reason ? { reason: data.reason } : null,
    });
    return { ok: true as const };
  });
