import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { scopeStoreIds } from "@/lib/inventory";
import { loadPeople } from "@/lib/people";
import { isoDaysAgo, lagosStartOf, lagosToday } from "@/lib/dates";
import { cn, fullDate, money } from "@/lib/format";
import { num } from "@/lib/types";
import { Card, PageHeader, StoreDot, td, th } from "@/components/ui";
import { FadeIn, Reveal } from "@/components/motion";

export const metadata = { title: "Cash-ups" };

type CashUp = {
  id: string;
  day: string;
  store_id: string;
  user_id: string;
  orders: number;
  sales_total: unknown;
  expected_cash: unknown;
  transfer_total: unknown;
  pos_total: unknown;
  other_total: unknown;
  counted_cash: unknown;
  note: string | null;
  closed_at: string;
};

export default async function CashUpsPage({ searchParams }: PageProps<"/app/cash-ups">) {
  const ctx = await getContext();
  if (!ctx.canManage) notFound();
  const cur = ctx.business.currency;
  const sp = await searchParams;
  const days = [7, 14, 30].includes(Number(sp.days)) ? Number(sp.days) : 14;
  const storeIds = scopeStoreIds(ctx);
  const none = ["00000000-0000-0000-0000-000000000000"];

  const [upsRes, todayRes, people] = await Promise.all([
    ctx.supabase
      .from("cash_ups")
      .select("*")
      .in("store_id", storeIds.length ? storeIds : none)
      .gte("day", isoDaysAgo(days).slice(0, 10))
      .order("day", { ascending: false })
      .order("closed_at", { ascending: false }),
    ctx.supabase
      .from("sale_payments")
      .select("store_id, created_by, method, amount")
      .in("store_id", storeIds.length ? storeIds : none)
      .gte("created_at", lagosStartOf("day")),
    loadPeople(ctx),
  ]);
  const ups = (upsRes.data ?? []) as CashUp[];
  const storeById = new Map(ctx.stores.map((s) => [s.id, s]));
  const today = lagosToday();

  // Who sold today, and whether they've closed.
  const open = new Map<string, { store_id: string; user_id: string; cash: number; total: number; orders: number }>();
  for (const p of (todayRes.data ?? []) as { store_id: string; created_by: string; method: string; amount: unknown }[]) {
    const k = `${p.store_id}:${p.created_by}`;
    const r = open.get(k) ?? { store_id: p.store_id, user_id: p.created_by, cash: 0, total: 0, orders: 0 };
    r.total += num(p.amount);
    if (p.method === "cash") r.cash += num(p.amount);
    r.orders += 1;
    open.set(k, r);
  }
  const closedToday = new Set(ups.filter((u) => u.day === today).map((u) => `${u.store_id}:${u.user_id}`));
  const notClosed = [...open.values()].filter((r) => !closedToday.has(`${r.store_id}:${r.user_id}`));

  const todayCash = [...open.values()].reduce((s, r) => s + r.cash, 0);
  const todayTotal = [...open.values()].reduce((s, r) => s + r.total, 0);
  const diffs = ups.map((u) => num(u.counted_cash) - num(u.expected_cash));
  const short = diffs.filter((d) => d < -0.5).reduce((s, d) => s + d, 0);
  const over = diffs.filter((d) => d > 0.5).reduce((s, d) => s + d, 0);

  return (
    <>
      <PageHeader
        title="Cash-ups"
        description="Each seller closes their day by counting the cash in the till. Short or over shows straight away."
        actions={
          <div className="flex rounded-xl border border-line bg-panel p-1 text-sm">
            {[7, 14, 30].map((d) => (
              <Link
                key={d}
                href={`/app/cash-ups?days=${d}`}
                className={cn("rounded-lg px-3 py-1.5 font-medium", d === days ? "bg-night text-white" : "text-muted hover:text-ink")}
              >
                {d} days
              </Link>
            ))}
          </div>
        }
      />

      <FadeIn className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: "Sold today", value: money(todayTotal, cur), sub: `${money(todayCash, cur)} of it in cash` },
          { label: "Not closed yet", value: String(notClosed.length), sub: notClosed.length ? "people who sold today" : "Everyone who sold has closed", alert: notClosed.length > 0 },
          { label: `Short, ${days} days`, value: money(-short, cur), sub: `${diffs.filter((d) => d < -0.5).length} days short`, bad: short < -0.5 },
          { label: `Over, ${days} days`, value: money(over, cur), sub: `${diffs.filter((d) => d > 0.5).length} days over` },
        ].map((s) => (
          <div key={s.label} className="bg-panel p-4 sm:p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={cn("mt-1 text-xl font-bold tnum sm:text-2xl", s.bad && "text-out", s.alert && "text-low")}>{s.value}</p>
            <p className="mt-0.5 text-xs text-faint">{s.sub}</p>
          </div>
        ))}
      </FadeIn>

      {notClosed.length > 0 && (
        <Reveal>
          <Card title="Still to close today" className="mt-6">
            <ul className="divide-y divide-line">
              {notClosed.map((r) => {
                const st = storeById.get(r.store_id);
                return (
                  <li key={`${r.store_id}-${r.user_id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="flex items-center gap-2">
                      {st && <StoreDot color={st.color} />}
                      <span className="font-medium">{people.get(r.user_id) ?? "Team member"}</span>
                      <span className="text-muted">· {st?.name}</span>
                    </span>
                    <span className="tnum text-muted">
                      {r.orders} sales · <span className="font-semibold text-ink">{money(r.cash, cur)}</span> cash expected
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>
      )}

      <Reveal>
        <Card title="Closed days" className="mt-6">
          {ups.length === 0 ? (
            <p className="px-5 py-12 text-center text-muted">
              No days closed yet. Sellers close their day from <span className="font-medium text-ink">Close my day</span> in the menu.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-sunk">
                  <tr>
                    <th className={th}>Day</th>
                    <th className={th}>Who</th>
                    <th className={th}>Store</th>
                    <th className={cn(th, "text-right")}>Sales</th>
                    <th className={cn(th, "text-right")}>Transfer + POS</th>
                    <th className={cn(th, "text-right")}>Cash expected</th>
                    <th className={cn(th, "text-right")}>Counted</th>
                    <th className={cn(th, "text-right")}>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {ups.map((u) => {
                    const diff = num(u.counted_cash) - num(u.expected_cash);
                    const st = storeById.get(u.store_id);
                    return (
                      <tr key={u.id} className="border-t border-line align-top">
                        <td className={cn(td, "whitespace-nowrap")}>{fullDate(u.day)}</td>
                        <td className={td}>
                          <span className="font-medium">{people.get(u.user_id) ?? "Team member"}</span>
                          {u.note && <span className="block max-w-56 text-xs text-faint">“{u.note}”</span>}
                        </td>
                        <td className={td}>
                          <span className="flex items-center gap-2">
                            {st && <StoreDot color={st.color} className="size-2" />}
                            {st?.name}
                          </span>
                        </td>
                        <td className={cn(td, "text-right tnum")}>
                          {money(num(u.sales_total), cur)}
                          <span className="block text-xs text-faint">{u.orders} sales</span>
                        </td>
                        <td className={cn(td, "text-right tnum text-muted")}>{money(num(u.transfer_total) + num(u.pos_total) + num(u.other_total), cur)}</td>
                        <td className={cn(td, "text-right tnum")}>{money(num(u.expected_cash), cur)}</td>
                        <td className={cn(td, "text-right font-semibold tnum")}>{money(num(u.counted_cash), cur)}</td>
                        <td className={cn(td, "text-right")}>
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-xs font-semibold tnum",
                              Math.abs(diff) < 1 ? "bg-ok/10 text-ok" : diff < 0 ? "bg-out/10 text-out" : "bg-low/12 text-low",
                            )}
                          >
                            {Math.abs(diff) < 1 ? "Balanced" : diff < 0 ? `−${money(-diff, cur)}` : `+${money(diff, cur)}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Reveal>
    </>
  );
}
