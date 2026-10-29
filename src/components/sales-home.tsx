import Link from "next/link";
import { Package, ShoppingCart } from "lucide-react";
import type { Context } from "@/lib/context";
import { loadCatalog, loadLevels, stockGrid } from "@/lib/inventory";
import { loadSalespeople } from "@/lib/salespeople";
import { greeting, lagosMonthProgress, lastDays } from "@/lib/dates";
import { money, qty, timeAgo } from "@/lib/format";
import { num, type Movement } from "@/lib/types";
import { Card, StatusBadge, StoreDot } from "./ui";
import { FadeIn, Reveal } from "./motion";
import { RevenueChart } from "./charts";
import { TargetRing } from "./salespeople";

/* A salesperson's home: what they've sold, their target and commission, and a big Sell button. */
export async function SalesHome({ ctx }: { ctx: Context }) {
  const cur = ctx.business.currency;
  const me = ctx.user.id;
  const storeIds = ctx.stores.map((s) => s.id);
  const [people, { products }, levels, dailyRes, recentRes] = await Promise.all([
    loadSalespeople(ctx),
    loadCatalog(ctx),
    loadLevels(ctx, storeIds),
    ctx.supabase.rpc("person_sales_by_day", { p_days: 14, p_person: me }),
    ctx.supabase.from("movements").select("*").eq("type", "sale").order("created_at", { ascending: false }).limit(60),
  ]);
  const self = people.find((p) => p.user_id === me);
  const today = self?.today ?? { revenue: 0, orders: 0, units: 0, cost: 0 };
  const month = self?.month ?? { revenue: 0, orders: 0, units: 0, cost: 0 };
  const target = self?.monthly_target ?? null;
  const pct = target ? (month.revenue / target) * 100 : null;
  const { day, days, monthName } = lagosMonthProgress();
  const remaining = target ? Math.max(0, target - month.revenue) : 0;

  const byDay = new Map(((dailyRes.data ?? []) as { day: string; revenue: unknown; orders: unknown }[]).map((d) => [d.day, d]));
  const series = lastDays(14).map((date) => {
    const d = byDay.get(date);
    return { day: date, revenue: num(d?.revenue), profit: 0, orders: num(d?.orders) };
  });

  // Group recent sale lines into receipts.
  const productById = new Map(products.map((p) => [p.id, p]));
  const receipts: { id: string; at: string; items: string[]; total: number }[] = [];
  for (const m of (recentRes.data ?? []) as Movement[]) {
    let r = receipts.find((x) => x.id === m.batch_id);
    if (!r) {
      if (receipts.length === 8) continue;
      r = { id: m.batch_id, at: m.created_at, items: [], total: 0 };
      receipts.push(r);
    }
    r.items.push(`${qty(-num(m.quantity))} × ${productById.get(m.product_id)?.name ?? "Item"}`);
    r.total += -num(m.quantity) * num(m.unit_price);
  }

  const low = stockGrid(products, ctx.stores, levels)
    .filter((r) => r.status !== "ok")
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 6);
  const first = (ctx.member.full_name || "").split(" ")[0];
  const store = ctx.stores.length === 1 ? ctx.stores[0] : null;

  return (
    <>
      <FadeIn className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
            {greeting()}
            {first && `, ${first}`}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-[15px] text-muted">
            {store && <StoreDot color={store.color} />}
            {store ? `Selling at ${store.name}` : `${ctx.business.name}`}
          </p>
        </div>
      </FadeIn>

      <FadeIn className="mb-6 grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[2fr_1fr]">
        <Link
          href="/app/sell"
          className="group flex items-center gap-4 rounded-2xl bg-pine px-5 py-5 text-white transition hover:-translate-y-0.5 hover:bg-pine-deep"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-citrus text-night transition group-hover:rotate-[-6deg]">
            <ShoppingCart size={24} />
          </span>
          <span>
            <span className="block text-lg font-bold">Start a sale</span>
            <span className="block text-sm text-white/70">Scan, search or tap products</span>
          </span>
        </Link>
        <Link href="/app/products" className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-5 py-5 font-semibold transition hover:-translate-y-0.5 hover:border-pine/40">
          <Package size={22} className="text-pine" />
          <span className="hidden sm:inline">Check stock & prices</span>
          <span className="sm:hidden">Stock</span>
        </Link>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
        <Reveal>
          <Card className="h-full p-5">
            <p className="text-sm text-muted">{monthName} target</p>
            <div className="mt-3 flex items-center gap-5">
              <div className="relative shrink-0">
                <TargetRing pct={pct} />
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-2xl font-bold tnum">{pct === null ? "—" : `${Math.round(pct)}%`}</p>
                    <p className="text-[11px] text-faint">of target</p>
                  </div>
                </div>
              </div>
              <div className="min-w-0 space-y-3">
                <div>
                  <p className="text-xs text-muted">Sold this month</p>
                  <p className="text-xl font-bold tnum">{money(month.revenue, cur)}</p>
                  {target && <p className="text-xs text-faint tnum">of {money(target, cur)}</p>}
                </div>
                {self && self.commission_rate > 0 && (
                  <div>
                    <p className="text-xs text-muted">Your commission ({self.commission_rate}%)</p>
                    <p className="text-xl font-bold text-ok tnum">{money(self.commission, cur)}</p>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-sunk px-3 py-2.5 text-sm text-muted">
              {target === null
                ? "No target set for you this month."
                : remaining > 0
                  ? <>
                      <span className="font-semibold text-ink tnum">{money(remaining, cur)}</span> to go with {days - day + 1} days left. You&rsquo;ve got this.
                    </>
                  : <span className="font-semibold text-ok">Target smashed. Well done!</span>}
            </p>
          </Card>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="grid h-full grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            {[
              { label: "Sold today", value: money(today.revenue, cur), sub: `${today.orders} ${today.orders === 1 ? "sale" : "sales"}` },
              { label: "Items today", value: qty(today.units), sub: "units sold" },
              { label: "Sales this month", value: String(month.orders), sub: `${qty(month.units)} items` },
              { label: "Average sale", value: money(month.orders ? month.revenue / month.orders : 0, cur), sub: monthName },
            ].map((s) => (
              <div key={s.label} className="bg-panel p-4 sm:p-5">
                <p className="text-sm text-muted">{s.label}</p>
                <p className="mt-1 text-xl font-bold tnum sm:text-2xl">{s.value}</p>
                <p className="mt-0.5 text-xs text-faint">{s.sub}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <Reveal>
          <Card className="p-5">
            <RevenueChart data={series} currency={cur} showProfit={false} />
          </Card>
        </Reveal>
        <Reveal delay={0.05}>
          <Card title="Your latest sales" action={<Link href="/app/movements" className="text-sm font-medium text-pine hover:underline">All</Link>}>
            {receipts.length === 0 ? (
              <p className="px-5 py-10 text-center text-muted">No sales yet. Your first one will show up here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {receipts.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.items.join(", ")}</span>
                      <span className="block text-xs text-faint">{timeAgo(r.at)}</span>
                    </span>
                    <span className="shrink-0 font-semibold tnum">{money(r.total, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>

      {low.length > 0 && (
        <Reveal>
          <Card title={`Running low${store ? ` at ${store.name}` : ""}`} className="mt-6 overflow-hidden" action={<span className="text-xs text-muted">Let your manager know</span>}>
            <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
              {low.map((r) => (
                <li key={`${r.store.id}-${r.product.id}`} className="flex items-center justify-between gap-3 bg-panel px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.product.name}</span>
                    <span className="text-xs text-faint tnum">
                      {qty(r.quantity)} {r.product.unit} left
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}
    </>
  );
}
