import "server-only";

/*
  Outgoing email through Resend (resend.com). Set RESEND_API_KEY in the
  environment; EMAIL_FROM is optional. Without a verified domain Resend only
  delivers to the address that owns the Resend account, which is fine while
  the only owner is you.
*/
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false as const, error: "Email isn't set up yet (RESEND_API_KEY is missing)." };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Stockline <onboarding@resend.dev>", ...msg }),
  });
  if (res.ok) return { ok: true as const };
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return { ok: false as const, error: body?.message ?? `Email failed (${res.status}).` };
}
