import { getContext, operatingStore } from "@/lib/context";
import { lagosStartOf, lagosToday } from "@/lib/dates";
import { cn, fullDate, money } from "@/lib/format";
import { num, PAYMENT_LABEL, type PaymentMethod } from "@/lib/types";
import { Card, EmptyState, PageHeader, StoreDot } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { CloseDayForm } from "@/components/close-day-form";

export const metadata = { title: "Close my day" };

type CashUp = {
  day: string;
  store_id: string;
  orders: number;
  sales_total: unknown;
  expected_cash: unknown;
  transfer_total: unknown;
  pos_total: unknown;
  counted_cash: unknown;
  closed_at: string;
};

export default async function CloseDayPage() {
  const ctx = await getContext();
  const cur = ctx.business.currency;
  const storeId = operatingStore(ctx);
  if (!storeId) return <EmptyState title="No store yet" body="You need a store before you can close a day." />;
  const store = ctx.stores.find((s) => s.id === storeId)!;

  const [paysRes, historyRes] = await Promise.all([
    ctx.supabase
      .from("sale_payments")
      .select("method, amount")
      .eq("store_id", storeId)
      .eq("created_by", ctx.user.id)
      .gte("created_at", lagosStartOf("day")),
    ctx.supabase.from("cash_ups").select("*").eq("user_id", ctx.user.id).order("day", { ascending: false }).limit(14),
  ]);

  const by: Record<PaymentMethod, number> = { cash: 0, transfer: 0, pos: 0, other: 0 };
  for (const p of (paysRes.data ?? []) as { method: PaymentMethod; amount: unknown }[]) by[p.method] += num(p.amount);
  const orders = (paysRes.data ?? []).length;
  const total = by.cash + by.transfer + by.pos + by.other;
  const history = (historyRes.data ?? []) as CashUp[];
  const today = history.find((h) => h.day === lagosToday() && h.store_id === storeId);

  return (
    <>
      <PageHeader
        title="Close my day"
        description={
          <span className="inline-flex items-center gap-2">
            <StoreDot color={store.color} /> Your sales at {store.name} today. Count the cash in the till and close.
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <FadeIn>
          <Card title="Today so far">
            <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
              {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => (
                <div key={m} className={cn("bg-panel p-4", m === "cash" && "bg-citrus/15")}>
                  <p className="text-sm text-muted">{PAYMENT_LABEL[m]}</p>
                  <p className="mt-1 text-xl font-bold tnum">{money(by[m], cur)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-baseline justify-between border-t border-line px-5 py-4">
              <span className="text-muted">
                {orders} {orders === 1 ? "sale" : "sales"} today
              </span>
              <span className="text-lg font-bold tnum">{money(total, cur)}</span>
            </div>
            <p className="border-t border-line bg-sunk/60 px-5 py-3 text-sm text-muted">
              The till should hold <span className="font-semibold text-ink tnum">{money(by.cash, cur)}</span> in cash from your sales. Transfers and
              POS don&rsquo;t go in the till.
            </p>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card title={today ? "You closed today. Update if needed" : "Count and close"}>
            <CloseDayForm storeId={storeId} expectedCash={by.cash} currency={cur} alreadyCounted={today ? num(today.counted_cash) : null} />
          </Card>
        </FadeIn>
      </div>

      <Card title="Your last closes" className="mt-6">
        {history.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">Days you close will show here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((h) => {
              const diff = num(h.counted_cash) - num(h.expected_cash);
              return (
                <li key={`${h.day}-${h.store_id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium">{fullDate(h.day)}</span>
                    <span className="block text-xs text-faint">
                      {h.orders} sales · {money(num(h.sales_total), cur)} · {ctx.stores.find((s) => s.id === h.store_id)?.name}
                    </span>
                  </span>
                  <span className="text-right tnum">
                    {money(num(h.counted_cash), cur)} counted
                    <span className={cn("block text-xs font-semibold", Math.abs(diff) < 1 ? "text-ok" : diff < 0 ? "text-out" : "text-low")}>
                      {Math.abs(diff) < 1 ? "Balanced" : diff < 0 ? `Short ${money(-diff, cur)}` : `Over ${money(diff, cur)}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
