import Link from "next/link";
import { ArrowLeftRight, ClipboardCheck, PackagePlus, ShoppingCart } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadCatalog, loadLevels, scopeStoreIds, stockGrid, suggestedOrder, totals } from "@/lib/inventory";
import { MOVEMENT_LABEL, num, type MovementType } from "@/lib/types";
import { cn, money, qty, timeAgo } from "@/lib/format";
import { Card, PageHeader, StatusBadge, StoreDot, td, th } from "@/components/ui";
import { HealthBar, RevenueChart } from "@/components/charts";
import { Onboarding } from "@/components/onboarding";
import { CountUp, FadeIn, Reveal } from "@/components/motion";
import { lastDays } from "@/lib/dates";
import { SalesHome } from "@/components/sales-home";
import { TargetBar } from "@/components/salespeople";
import { loadSalespeople } from "@/lib/salespeople";
import { lagosMonthProgress } from "@/lib/dates";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const ctx = await getContext();
  if (ctx.isSales) return <SalesHome ctx={ctx} />;
  const cur = ctx.business.currency;
  const storeIds = scopeStoreIds(ctx);
  const storeParam = ctx.activeStore === "all" ? null : ctx.activeStore;
  const scopeStores = ctx.stores.filter((s) => storeIds.includes(s.id));

  const [{ products }, levels, salesRes, topRes, storeSalesRes, recentRes, sellers] = await Promise.all([
    loadCatalog(ctx),
    loadLevels(ctx, storeIds),
    ctx.supabase.rpc("sales_by_day", { p_days: 30, p_store: storeParam }),
    ctx.supabase.rpc("product_sales", { p_days: 30, p_store: storeParam }),
    ctx.supabase.rpc("store_sales", { p_days: 30 }),
    ctx.supabase
      .from("movements")
      .select("id, type, quantity, created_at, product_id, store_id, batch_id, unit_price")
      .in("store_id", storeIds.length ? storeIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(10),
    loadSalespeople(ctx, { scopeToActiveStore: true }),
  ]);

  if (products.length === 0 || ctx.stores.length === 0) {
    return (
      <>
        <PageHeader title={`Welcome to Stockline`} description={`Let's get ${ctx.business.name} set up.`} />
        <Onboarding isOwner={ctx.isOwner} hasStores={ctx.stores.length > 0} />
      </>
    );
  }

  const grid = stockGrid(products, scopeStores, levels);
  const t = totals(grid);

  // Fill missing days with zeros so the chart has 30 even bars.
  const byDay = new Map(((salesRes.data ?? []) as { day: string; revenue: unknown; cost: unknown; orders: unknown }[]).map((d) => [d.day, d]));
  const days = lastDays(30).map((date) => {
    const d = byDay.get(date);
    return { day: date, revenue: num(d?.revenue), profit: num(d?.revenue) - num(d?.cost), orders: num(d?.orders) };
  });
  const today = days[days.length - 1];
  const week = days.slice(-7).reduce((s, d) => s + d.revenue, 0);

  const productById = new Map(products.map((p) => [p.id, p]));
  const storeById = new Map(ctx.stores.map((s) => [s.id, s]));

  const reorder = grid
    .filter((r) => r.status !== "ok")
    .sort((a, b) => a.quantity / Math.max(1, a.product.reorder_level) - b.quantity / Math.max(1, b.product.reorder_level))
    .slice(0, 8);

  const top = ((topRes.data ?? []) as { product_id: string; units: unknown; revenue: unknown; profit: unknown }[])
    .map((r) => ({ product: productById.get(r.product_id), units: num(r.units), revenue: num(r.revenue) }))
    .filter((r) => r.product)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const topMax = Math.max(1, ...top.map((r) => r.revenue));

  const storeRevenue = new Map(
    ((storeSalesRes.data ?? []) as { store_id: string; revenue: unknown }[]).map((r) => [r.store_id, num(r.revenue)]),
  );

  const scopeName = ctx.activeStore === "all" ? "all stores" : storeById.get(ctx.activeStore)?.name;
  const first = (ctx.member.full_name || "").split(" ")[0];

  return (
    <>
      <PageHeader
        title={first ? `Good to see you, ${first}` : "Overview"}
        description={<>Showing {scopeName}. Switch stores at the top right.</>}
      />

      <FadeIn className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/app/sell", label: "Sell", icon: ShoppingCart, tone: "bg-pine text-white hover:bg-pine-deep" },
          { href: "/app/receive", label: "Receive stock", icon: PackagePlus, tone: "bg-panel border border-line hover:border-pine/40" },
          ...(ctx.stores.length > 1 ? [{ href: "/app/transfer", label: "Transfer", icon: ArrowLeftRight, tone: "bg-panel border border-line hover:border-pine/40" }] : []),
          ...(ctx.canManage ? [{ href: "/app/count", label: "Stock count", icon: ClipboardCheck, tone: "bg-panel border border-line hover:border-pine/40" }] : []),
        ].map((a) => (
          <Link key={a.href} href={a.href} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3.5 font-semibold transition hover:-translate-y-0.5", a.tone)}>
            <a.icon size={20} />
            {a.label}
          </Link>
        ))}
      </FadeIn>

      <FadeIn delay={0.05} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: "Sales today", value: today.revenue, sub: `${today.orders} ${today.orders === 1 ? "sale" : "sales"}`, money: true },
          { label: "Sales this week", value: week, sub: "Last 7 days", money: true },
          { label: "Stock value (cost)", value: t.cost, sub: `${money(t.retail, cur)} at selling price`, money: true },
          { label: "Need attention", value: t.low + t.out, sub: `${t.out} out · ${t.low} low`, money: false, alert: t.out > 0 },
        ].map((s) => (
          <div key={s.label} className="bg-panel p-4 sm:p-5">
            <p className="text-sm text-muted">{s.label}</p>
            {s.money ? (
              <p className="mt-1 text-xl font-bold tnum sm:text-2xl">{money(s.value, cur)}</p>
            ) : (
              <CountUp value={s.value} className={cn("mt-1 block text-xl font-bold tnum sm:text-2xl", s.alert && "text-out")} />
            )}
            <p className="mt-0.5 text-xs text-faint">{s.sub}</p>
          </div>
        ))}
      </FadeIn>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <Reveal>
          <Card className="p-5">
            <RevenueChart data={days} currency={cur} />
          </Card>
        </Reveal>

        <Reveal delay={0.05}>
          <Card title="Stores" action={<Link href="/app/stores" className="text-sm font-medium text-pine hover:underline">All stores</Link>}>
            <ul className="divide-y divide-line">
              {scopeStores.map((s) => {
                const rows = grid.filter((r) => r.store.id === s.id);
                const st = totals(rows);
                return (
                  <li key={s.id} className="px-5 py-4">
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <Link href={`/app/stores/${s.id}`} className="flex items-center gap-2 font-semibold hover:text-pine">
                        <StoreDot color={s.color} />
                        {s.name}
                      </Link>
                      <span className="text-sm text-muted tnum">{money(st.cost, cur)}</span>
                    </div>
                    <HealthBar ok={st.ok} low={st.low} out={st.out} />
                    <p className="mt-2 flex justify-between text-xs text-muted tnum">
                      <span>
                        {st.ok} healthy · <span className="text-low">{st.low} low</span> · <span className="text-out">{st.out} out</span>
                      </span>
                      <span>{money(storeRevenue.get(s.id) ?? 0, cur)} sold in 30 days</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <Reveal>
          <Card
            title="Reorder soon"
            action={<Link href="/app/products?status=low" className="text-sm font-medium text-pine hover:underline">See all</Link>}
          >
            {reorder.length === 0 ? (
              <p className="px-5 py-8 text-center text-muted">Everything is above its reorder level.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-sunk">
                    <tr>
                      <th className={th}>Product</th>
                      <th className={th}>Store</th>
                      <th className={cn(th, "text-right")}>On hand</th>
                      <th className={cn(th, "text-right")}>Order</th>
                      <th className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reorder.map((r) => (
                      <tr key={`${r.store.id}-${r.product.id}`} className="border-t border-line">
                        <td className={td}>
                          <Link href={`/app/products/${r.product.id}`} className="font-medium hover:text-pine">
                            {r.product.name}
                          </Link>
                          <span className="block font-mono text-xs text-faint">{r.product.sku}</span>
                        </td>
                        <td className={td}>
                          <span className="flex items-center gap-2">
                            <StoreDot color={r.store.color} />
                            {r.store.name}
                          </span>
                        </td>
                        <td className={cn(td, "text-right tnum")}>
                          {qty(r.quantity)} <span className="text-faint">/ {qty(r.product.reorder_level)}</span>
                        </td>
                        <td className={cn(td, "text-right font-semibold tnum")}>
                          +{qty(suggestedOrder(r.quantity, r.product.reorder_level))} {r.product.unit}
                        </td>
                        <td className={td}>
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </Reveal>

        <div className="space-y-6">
          {sellers.some((p) => p.active) && (
            <Reveal delay={0.05}>
              <Card
                title={`Salespeople, ${lagosMonthProgress().monthName}`}
                action={ctx.canManage && <Link href="/app/salespeople" className="text-sm font-medium text-pine hover:underline">Manage</Link>}
              >
                <ul className="divide-y divide-line">
                  {sellers.filter((p) => p.active).slice(0, 5).map((p) => (
                    <li key={p.user_id} className="px-5 py-3">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <Link href={ctx.canManage ? `/app/salespeople/${p.user_id}` : "#"} className="flex min-w-0 items-center gap-2 font-medium hover:text-pine">
                          <StoreDot color={p.store?.color ?? "#123d2f"} className="size-2" />
                          <span className="truncate">{p.full_name}</span>
                        </Link>
                        <span className="shrink-0 tnum">
                          {money(p.month.revenue, cur)}
                          <span className="ml-2 text-xs text-faint">{money(p.today.revenue, cur)} today</span>
                        </span>
                      </div>
                      <TargetBar pct={p.targetPct} className="mt-2 h-1.5" />
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          )}
          <Reveal delay={0.05}>
            <Card title="Best sellers, 30 days">
              <ul className="space-y-3 px-5 py-4">
                {top.map((r) => (
                  <li key={r.product!.id}>
                    <div className="flex justify-between gap-3 text-sm">
                      <Link href={`/app/products/${r.product!.id}`} className="truncate font-medium hover:text-pine">
                        {r.product!.name}
                      </Link>
                      <span className="shrink-0 tnum">{money(r.revenue, cur)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-sunk">
                      <div className="h-full rounded-full bg-pine" style={{ width: `${(r.revenue / topMax) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-faint tnum">{qty(r.units)} sold</p>
                  </li>
                ))}
                {top.length === 0 && <li className="py-4 text-center text-muted">No sales in the last 30 days.</li>}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card title="Latest activity" action={<Link href="/app/movements" className="text-sm font-medium text-pine hover:underline">History</Link>}>
              <ul className="divide-y divide-line">
                {(recentRes.data ?? []).map((m: { id: string; type: MovementType; quantity: unknown; created_at: string; product_id: string; store_id: string }) => {
                  const q = num(m.quantity);
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <span className={cn("w-12 shrink-0 text-right font-semibold tnum", q > 0 ? "text-ok" : "text-ink")}>
                        {q > 0 ? "+" : "−"}
                        {qty(Math.abs(q))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{productById.get(m.product_id)?.name ?? "Product"}</span>
                        <span className="block truncate text-xs text-faint">
                          {MOVEMENT_LABEL[m.type]} · {storeById.get(m.store_id)?.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-faint">{timeAgo(m.created_at)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>
    </>
  );
}
