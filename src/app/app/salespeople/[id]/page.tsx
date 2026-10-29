import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle, Phone } from "lucide-react";
import { getContext } from "@/lib/context";
import { assignableStores, loadSalespeople } from "@/lib/salespeople";
import { loadCatalog } from "@/lib/inventory";
import { isoDaysAgo, lagosMonthProgress, lastDays } from "@/lib/dates";
import { cn, fullDate, money, qty, timeAgo } from "@/lib/format";
import { num, type Movement } from "@/lib/types";
import { Card, EmptyState, StoreDot } from "@/components/ui";
import { FadeIn, Reveal } from "@/components/motion";
import { RevenueChart } from "@/components/charts";
import { MovementTable } from "@/components/movement-list";
import { SalespersonActions, TargetBar } from "@/components/salespeople";

export const metadata = { title: "Salesperson" };

export default async function SalespersonPage({ params }: PageProps<"/app/salespeople/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.canManage) notFound();
  const cur = ctx.business.currency;

  const [people, { products, suppliers }, dailyRes, recentRes] = await Promise.all([
    loadSalespeople(ctx),
    loadCatalog(ctx),
    ctx.supabase.rpc("person_sales_by_day", { p_days: 30, p_person: id }),
    ctx.supabase
      .from("movements")
      .select("*")
      .eq("created_by", id)
      .eq("type", "sale")
      .gte("created_at", isoDaysAgo(30))
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  const p = people.find((r) => r.user_id === id);
  if (!p) notFound();

  const { stores, allowAllStores } = assignableStores(ctx);
  const { day, days, monthName } = lagosMonthProgress();
  const expected = (day / days) * 100;

  const byDay = new Map(((dailyRes.data ?? []) as { day: string; revenue: unknown; cost: unknown; orders: unknown }[]).map((d) => [d.day, d]));
  const series = lastDays(30).map((date) => {
    const d = byDay.get(date);
    return { day: date, revenue: num(d?.revenue), profit: num(d?.revenue) - num(d?.cost), orders: num(d?.orders) };
  });
  const total30 = series.reduce((s, d) => s + d.revenue, 0);
  const orders30 = series.reduce((s, d) => s + d.orders, 0);
  const activeDays = series.filter((d) => d.orders > 0).length;

  const sales = (recentRes.data ?? []) as Movement[];
  const productById = new Map(products.map((x) => [x.id, x]));
  const byProduct = new Map<string, { units: number; revenue: number }>();
  for (const m of sales) {
    const agg = byProduct.get(m.product_id) ?? { units: 0, revenue: 0 };
    agg.units += -num(m.quantity);
    agg.revenue += -num(m.quantity) * num(m.unit_price);
    byProduct.set(m.product_id, agg);
  }
  const top = [...byProduct.entries()]
    .map(([pid, v]) => ({ product: productById.get(pid), ...v }))
    .filter((r) => r.product)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const topMax = Math.max(1, ...top.map((t) => t.revenue));
  const remaining = p.monthly_target ? Math.max(0, p.monthly_target - p.month.revenue) : 0;
  const perDayNeeded = remaining > 0 ? remaining / Math.max(1, days - day + 1) : 0;
  const phoneDigits = (p.phone ?? "").replace(/\D/g, "");
  const intl = phoneDigits.startsWith("0") ? `234${phoneDigits.slice(1)}` : phoneDigits;
  const storeById = new Map(ctx.stores.map((s) => [s.id, s]));

  return (
    <>
      <Link href="/app/salespeople" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Salespeople
      </Link>

      <FadeIn className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white"
            style={{ background: p.store?.color ?? "#123d2f" }}
          >
            {(p.full_name ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
          </span>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight sm:text-[28px]">
              {p.full_name}
              {!p.active && <span className="rounded-full bg-out/10 px-2.5 py-0.5 text-xs font-semibold text-out">Turned off</span>}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span className="font-mono">{p.username}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                {p.store && <StoreDot color={p.store.color} className="size-2" />}
                {p.store?.name ?? "All stores"}
              </span>
              <span>·</span>
              <span>since {fullDate(p.created_at)}</span>
            </p>
            {p.phone && (
              <p className="mt-2 flex gap-2">
                <a href={`tel:${phoneDigits}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-sm hover:bg-sunk">
                  <Phone size={14} /> {p.phone}
                </a>
                <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-sm hover:bg-sunk">
                  <MessageCircle size={14} /> WhatsApp
                </a>
              </p>
            )}
          </div>
        </div>
        {p.manageable && <SalespersonActions person={p} stores={stores} allowAllStores={allowAllStores} businessName={ctx.business.name} layout="buttons" />}
      </FadeIn>

      <FadeIn delay={0.05} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: "Today", value: money(p.today.revenue, cur), sub: `${p.today.orders} ${p.today.orders === 1 ? "sale" : "sales"}` },
          { label: `${monthName} so far`, value: money(p.month.revenue, cur), sub: `${p.month.orders} sales · ${qty(p.month.units)} items` },
          p.commission_rate > 0
            ? { label: "Commission earned", value: money(p.commission, cur), sub: `${p.commission_rate}% of ${monthName} sales` }
            : { label: "Items sold", value: qty(p.month.units), sub: `${monthName} so far` },
          {
            label: "Average sale",
            value: money(orders30 ? total30 / orders30 : 0, cur),
            sub: `${activeDays} of the last 30 days selling`,
          },
        ].map((s) => (
          <div key={s.label} className="bg-panel p-4 sm:p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-xl font-bold tnum sm:text-2xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-faint">{s.sub}</p>
          </div>
        ))}
      </FadeIn>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <Reveal>
          <Card className="p-5">
            <RevenueChart data={series} currency={cur} />
          </Card>
        </Reveal>
        <div className="space-y-6">
          <Reveal delay={0.05}>
            <Card title={`${monthName} target`}>
              <div className="p-5">
                {p.monthly_target ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-3xl font-bold tnum">{Math.round(p.targetPct ?? 0)}%</p>
                      <p className="text-sm text-muted tnum">
                        {money(p.month.revenue, cur)} of {money(p.monthly_target, cur)}
                      </p>
                    </div>
                    <TargetBar pct={p.targetPct} expectedPct={expected} className="mt-3 h-3" />
                    <p className="mt-3 text-sm text-muted">
                      {remaining > 0 ? (
                        <>
                          <span className="font-semibold text-ink tnum">{money(remaining, cur)}</span> to go, about{" "}
                          <span className="font-semibold text-ink tnum">{money(perDayNeeded, cur)}</span> a day for the rest of {monthName}.
                        </>
                      ) : (
                        <span className="font-semibold text-ok">Target reached. Everything from here is extra.</span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted">No monthly target yet. Use “Edit details” to set one.</p>
                )}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card title="What they sell most, 30 days">
              {top.length === 0 ? (
                <p className="px-5 py-8 text-center text-muted">No sales in the last 30 days.</p>
              ) : (
                <ul className="space-y-3 px-5 py-4">
                  {top.map((t) => (
                    <li key={t.product!.id}>
                      <div className="flex justify-between gap-3 text-sm">
                        <Link href={`/app/products/${t.product!.id}`} className="truncate font-medium hover:text-pine">
                          {t.product!.name}
                        </Link>
                        <span className="shrink-0 tnum">{money(t.revenue, cur)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-sunk">
                        <div className="h-full rounded-full bg-pine" style={{ width: `${(t.revenue / topMax) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-faint tnum">
                        {qty(t.units)} {t.product!.unit} sold
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>
        </div>
      </div>

      <Reveal>
        <Card
          title="Recent sales"
          className="mt-6"
          action={sales[0] && <span className="text-sm text-muted">Last sale {timeAgo(sales[0].created_at)}</span>}
        >
          {sales.length === 0 ? (
            <EmptyState title="No sales yet" body="Sales they record will show up here straight away." />
          ) : (
            <div className={cn(!p.active && "opacity-80")}>
              <MovementTable
                rows={sales.slice(0, 20)}
                products={productById}
                stores={storeById}
                suppliers={new Map(suppliers.map((s) => [s.id, s]))}
                people={new Map([[p.user_id, p.full_name ?? "Salesperson"]])}
                currency={cur}
              />
            </div>
          )}
        </Card>
      </Reveal>
    </>
  );
}
