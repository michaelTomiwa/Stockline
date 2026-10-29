/* The "new sale" email: a small receipt with today's running total and anything now running low. */

export type SalePayload = {
  to: string;
  business: string;
  currency: string;
  seller: string;
  store: string | null;
  at: string;
  reference: string | null;
  total: number;
  today_total: number;
  today_orders: number;
  items: { name: string; unit: string; quantity: number; price: number; left: number; low: boolean }[];
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function saleEmail(p: SalePayload, appUrl: string) {
  const fmt = new Intl.NumberFormat("en-NG", { style: "currency", currency: p.currency, maximumFractionDigits: 0 });
  const money = (n: number) => fmt.format(Number(n));
  const qty = (n: number) => Number(n).toLocaleString("en-NG", { maximumFractionDigits: 2 });
  const when = new Date(p.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
  const low = p.items.filter((i) => i.low);
  const where = p.store ? ` at ${p.store}` : "";

  const subject = `${money(p.total)} sale${where} by ${p.seller}`;

  const rows = p.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eef1ea;color:#141a17">${qty(i.quantity)} × ${esc(i.name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eef1ea;text-align:right;color:#141a17;white-space:nowrap">${money(i.quantity * i.price)}</td>
      </tr>`,
    )
    .join("");

  const lowBlock = low.length
    ? `<div style="margin-top:20px;padding:14px 16px;border-radius:12px;background:#fdf6e7;color:#7a4f12;font-size:14px">
        <strong>Running low${where}:</strong> ${low.map((i) => `${esc(i.name)} (${qty(i.left)} ${esc(i.unit)} left)`).join(", ")}
      </div>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f1f3ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <div style="background:#0f201a;border-radius:16px 16px 0 0;padding:20px 24px;color:#ffffff">
      <div style="font-size:13px;color:#d6f26b;font-weight:600;letter-spacing:.02em">STOCKLINE · ${esc(p.business)}</div>
      <div style="font-size:28px;font-weight:700;margin-top:6px">${money(p.total)}</div>
      <div style="font-size:14px;color:rgba(255,255,255,.7);margin-top:2px">New sale${esc(where)} · ${esc(when)}</div>
    </div>
    <div style="background:#ffffff;border:1px solid #e0e4dc;border-top:0;border-radius:0 0 16px 16px;padding:20px 24px">
      <p style="margin:0 0 12px;font-size:15px;color:#59635d">Sold by <strong style="color:#141a17">${esc(p.seller)}</strong>${p.reference ? ` · Ref ${esc(p.reference)}` : ""}</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">${rows}
        <tr><td style="padding:10px 0 0;font-weight:700">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:700">${money(p.total)}</td></tr>
      </table>
      <div style="margin-top:20px;padding:14px 16px;border-radius:12px;background:#f7f8f5;font-size:14px;color:#59635d">
        Today so far: <strong style="color:#141a17">${money(p.today_total)}</strong> from ${p.today_orders} ${p.today_orders === 1 ? "sale" : "sales"}
      </div>
      ${lowBlock}
      <a href="${appUrl}/app/movements?type=sale" style="display:inline-block;margin-top:20px;background:#1f5f4a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:12px">Open Stockline</a>
    </div>
    <p style="font-size:12px;color:#8b948e;text-align:center;margin-top:16px">You get this because sale emails are on in Stockline settings.</p>
  </div></body></html>`;

  const text = [
    `New sale${where} by ${p.seller}: ${money(p.total)}`,
    when,
    "",
    ...p.items.map((i) => `${qty(i.quantity)} x ${i.name}  ${money(i.quantity * i.price)}`),
    "",
    `Today so far: ${money(p.today_total)} from ${p.today_orders} sales`,
    ...(low.length ? ["", `Running low: ${low.map((i) => `${i.name} (${qty(i.left)} left)`).join(", ")}`] : []),
    "",
    `${appUrl}/app/movements?type=sale`,
  ].join("\n");

  return { subject, html, text };
}
