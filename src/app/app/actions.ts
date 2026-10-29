"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { STORE_COOKIE } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { saleEmail, type SalePayload } from "@/lib/sale-email";

export async function setActiveStore(storeId: string) {
  (await cookies()).set(STORE_COOKIE, storeId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/app", "layout");
}

async function appUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
}

/*
  Called right after a sale. The database decides whether an email is due
  (owner's settings, not the owner's own sale, not already sent) and hands
  back what to put in it.
*/
export async function notifySale(batchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_sale_notification", { p_batch: batchId });
  if (error || !data) return { sent: false };
  const payload = data as SalePayload;
  if (!payload.to) return { sent: false };
  const msg = saleEmail(payload, await appUrl());
  const res = await sendEmail({ to: payload.to, ...msg });
  if (!res.ok) console.error("Sale email failed:", res.error);
  return { sent: res.ok };
}

/* Settings → "Send a test email". Owners only. */
export async function sendTestSaleEmail(to: string) {
  const supabase = await createClient();
  const [{ data: role }, { data: business }] = await Promise.all([
    supabase.rpc("my_role"),
    supabase.from("businesses").select("name, currency").maybeSingle(),
  ]);
  if (role !== "owner" || !business) return { ok: false, error: "Only the owner can do this." };
  const msg = saleEmail(
    {
      to,
      business: business.name,
      currency: business.currency,
      seller: "Test Salesperson",
      store: "Your store",
      at: new Date().toISOString(),
      reference: null,
      total: 12500,
      today_total: 86400,
      today_orders: 9,
      items: [
        { name: "Example product", unit: "pack", quantity: 2, price: 4500, left: 30, low: false },
        { name: "Another product", unit: "bottle", quantity: 1, price: 3500, left: 3, low: true },
      ],
    },
    await appUrl(),
  );
  return sendEmail({ to, ...msg, subject: `Test: ${msg.subject}` });
}
