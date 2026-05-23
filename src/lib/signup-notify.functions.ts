import { createServerFn } from "@tanstack/react-start";

type Payload = {
  fullName: string;
  companyName: string;
  businessType: string;
  phone: string;
  email: string;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const notifyAdminOfSignup = createServerFn({ method: "POST" })
  .inputValidator((input: Payload) => {
    if (!input || typeof input !== "object") throw new Error("Invalid payload");
    const out: Payload = {
      fullName: String(input.fullName ?? "").slice(0, 200),
      companyName: String(input.companyName ?? "").slice(0, 200),
      businessType: String(input.businessType ?? "").slice(0, 200),
      phone: String(input.phone ?? "").slice(0, 50),
      email: String(input.email ?? "").slice(0, 320),
    };
    if (!out.email) throw new Error("Email required");
    return out;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
    // HARDCODED: Resend requires a verified domain. Until one is configured,
    // always send from Resend's shared verified sender. Ignore RESEND_FROM_EMAIL entirely.
    const fromEmail = "InventoryFlow <onboarding@resend.dev>";

    if (!apiKey || !adminEmail) {
      console.warn("[signup-notify] missing RESEND_API_KEY or ADMIN_NOTIFICATION_EMAIL — skipping");
      return { sent: false, reason: "not_configured" };
    }

    const signupDate = new Date().toISOString();
    const rows: Array<[string, string]> = [
      ["Full name", data.fullName || "—"],
      ["Company", data.companyName || "—"],
      ["Business type", data.businessType || "—"],
      ["Phone", data.phone || "—"],
      ["Email", data.email],
      ["Signup date", signupDate],
    ];

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">New InventoryFlow Access Request</h2>
        <p style="color:#555;margin:0 0 20px">A new user has signed up and is awaiting approval.</p>
        <table style="width:100%;border-collapse:collapse">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:8px 12px;background:#f7f7f9;border:1px solid #eee;font-weight:600;width:40%">${escapeHtml(
                  k,
                )}</td><td style="padding:8px 12px;border:1px solid #eee">${escapeHtml(v)}</td></tr>`,
            )
            .join("")}
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px">Sent automatically by InventoryFlow.</p>
      </div>`;

    const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [adminEmail],
          subject: "New InventoryFlow Access Request",
          html,
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[signup-notify] Resend failed [${res.status}]: ${body}`);
        return { sent: false, reason: `http_${res.status}` };
      }
      console.log(`[signup-notify] admin notified for ${data.email}`);
      return { sent: true };
    } catch (e: any) {
      console.error("[signup-notify] error:", e?.message ?? e);
      return { sent: false, reason: "exception" };
    }
  });
