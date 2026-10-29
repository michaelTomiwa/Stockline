import Link from "next/link";
import { getStockContext } from "@/lib/context";
import { loadCatalog, loadLevels, scopeStoreIds, stockGrid } from "@/lib/inventory";
import { num } from "@/lib/types";
import { cn, money, qty } from "@/lib/format";
import { Card, PageHeader, td, th } from "@/components/ui";
import { RevenueChart } from "@/components/charts";
import { CompareBars, Donut, Heatmap } from "@/components/report-charts";
import { Reveal } from "@/components/motion";
import { isoDaysAgo, lastDays } from "@/lib/dates";

export const metadata = { title: "Reports" };

const PALETTE = ["#1F5F4A", "#3A6EA5", "#B7791F", "#8B3A62", "#2F855A", "#C2410C", "#5B5BD6", "#0E7490", "#8B948E"];

export default async function ReportsPage({ searchParams }: PageProps<"/app/reports">) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const ctx = await getStockContext();
  const cur = ctx.business.currency;
  const storeIds = scopeStoreIds(ctx);
  const storeParam = ctx.activeStore === "all" ? null : ctx.activeStore;
  const since = isoDaysAgo(days);

  const [{ products, categories }, levels, dayRes, prodRes, storeRes, salesRows, personRes, membersRes] = await Promise.all([
    loadCatalog(ctx),
    loadLevels(ctx, storeIds),
    ctx.supabase.rpc("sales_by_day", { p_days: days, p_store: storeParam }),
    ctx.supabase.rpc("product_sales", { p_days: days, p_store: storeParam }),
    ctx.supabase.rpc("store_sales", { p_days: days }),
    ctx.supabase
      .from("movements")
      .select("batch_id, created_at")
      .eq("type", "sale")
      .in("store_id", storeIds.length ? storeIds : ["00000000-0000-0000-0000-000000000000"])
      .gte("created_at", since)
      .limit(10000),
    ctx.supabase.rpc("sales_by_person", { p_since: since, p_store: storeParam }),
    ctx.supabase.from("members").select("user_id, full_name, email, role, store_id"),
  ]);

  const byDay = new Map(((dayRes.data ?? []) as { day: string; revenue: unknown; cost: unknown; orders: unknown }[]).map((d) => [d.day, d]));
  const series = lastDays(days).map((date) => {
    const d = byDay.get(date);
    return { day: date, revenue: num(d?.revenue), profit: num(d?.revenue) - num(d?.cost), orders: num(d?.orders) };
  });
  const revenue = series.reduce((s, d) => s + d.revenue, 0);
  const profit = series.reduce((s, d) => s + d.profit, 0);
  const orders = series.reduce((s, d) => s + d.orders, 0);

  const productById = new Map(products.map((p) => [p.id, p]));

  // Who rang up the sales in this period.
  const memberById = new Map(
    ((membersRes.data ?? []) as { user_id: string; full_name: string | null; email: string | null; role: string; store_id: string | null }[]).map((m) => [m.user_id, m]),
  );
  const storeColor = new Map(ctx.stores.map((st) => [st.id, st.color]));
  const personRows = ((personRes.data ?? []) as { user_id: string | null; revenue: unknown; cost: unknown; orders: unknown }[])
    .map((r) => {
      const m = r.user_id ? memberById.get(r.user_id) : undefined;
      const rev = num(r.revenue);
      return {
        label: m ? `${m.full_name || m.email || "Team member"}${m.role === "sales" ? "" : ` (${m.role})`}` : "Former team member",
        color: (m?.store_id && storeColor.get(m.store_id)) || "#123d2f",
        revenue: rev,
        profit: rev - num(r.cost),
        sub: `${num(r.orders)} sales · ${money(num(r.orders) ? rev / num(r.orders) : 0, cur)} average`,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const prodSales = ((prodRes.data ?? []) as { product_id: string; units: unknown; revenue: unknown; profit: unknown }[]).map((r) => ({
    product: productById.get(r.product_id),
    units: num(r.units),
    revenue: num(r.revenue),
    profit: num(r.profit),
  }));
  const best = [...prodSales].filter((r) => r.product).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Slow movers: in stock but sold little or nothing in the period.
  const grid = stockGrid(products, ctx.stores.filter((s) => storeIds.includes(s.id)), levels);
  const onHand = new Map<string, number>();
  for (const r of grid) onHand.set(r.product.id, (onHand.get(r.product.id) ?? 0) + r.quantity);
  const unitsSold = new Map(prodSales.map((r) => [r.product?.id, r.units]));
  const slow = products
    .map((p) => ({ product: p, onHand: onHand.get(p.id) ?? 0, sold: unitsSold.get(p.id) ?? 0 }))
    .filter((r) => r.onHand > 0)
    .sort((a, b) => a.sold / a.onHand - b.sold / b.onHand)
    .slice(0, 6);

  const storeRows = ((storeRes.data ?? []) as { store_id: string; revenue: unknown; profit: unknown; orders: unknown }[])
    .map((r) => {
      const s = ctx.stores.find((x) => x.id === r.store_id);
      return s ? { label: s.name, color: s.color, revenue: num(r.revenue), profit: num(r.profit), sub: `${num(r.orders)} sales` } : null;
    })
    .filter((r) => r !== null)
    .sort((a, b) => b.revenue - a.revenue);

  const catValue = new Map<string, number>();
  for (const r of grid) {
    const name = categories.find((c) => c.id === r.product.category_id)?.name ?? "Uncategorised";
    catValue.set(name, (catValue.get(name) ?? 0) + Math.max(0, r.quantity) * r.product.cost_price);
  }
  const donut = [...catValue.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));

  // Heatmap of orders by weekday × hour (Lagos time)
  const cells = Array.from({ length: 7 }, () => Array(13).fill(0) as number[]);
  const seen = new Set<string>();
  for (const m of salesRows.data ?? []) {
    if (seen.has(m.batch_id)) continue;
    seen.add(m.batch_id);
    const d = new Date(new Date(m.created_at).toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
    const h = d.getHours() - 8;
    if (h >= 0 && h < 13) cells[(d.getDay() + 6) % 7][h]++;
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Sales and stock for ${ctx.activeStore === "all" ? "all stores" : ctx.stores.find((s) => s.id === ctx.activeStore)?.name}.`}
        actions={
          <div className="flex rounded-xl border border-line bg-panel p-1 text-sm">
            {[7, 30, 90].map((d) => (
              <Link key={d} href={`/app/reports?days=${d}`} className={cn("rounded-lg px-3 py-1.5 font-medium", d === days ? "bg-night text-white" : "text-muted hover:text-ink")}>
                {d} days
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: "Revenue", value: money(revenue, cur) },
          { label: "Gross profit", value: money(profit, cur), sub: revenue ? `${Math.round((profit / revenue) * 100)}% margin` : undefined },
          { label: "Sales", value: qty(orders), sub: orders ? `${money(revenue / orders, cur)} average` : undefined },
          { label: "Units sold", value: qty(prodSales.reduce((s, r) => s + r.units, 0)) },
        ].map((s) => (
          <div key={s.label} className="bg-panel p-4 sm:p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-xl font-bold tnum sm:text-2xl">{s.value}</p>
            {s.sub && <p className="mt-0.5 text-xs text-faint">{s.sub}</p>}
          </div>
        ))}
      </div>

      <Reveal className="mt-6">
        <Card className="p-5">
          <RevenueChart data={series} currency={cur} />
        </Card>
      </Reveal>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {storeRows.length > 1 && ctx.activeStore === "all" && (
          <Reveal>
            <Card title="Stores compared" className="h-full">
              <div className="p-5">
                <CompareBars rows={storeRows} currency={cur} />
              </div>
            </Card>
          </Reveal>
        )}
        {personRows.length > 1 && (
          <Reveal delay={0.05}>
            <Card
              title="Sales by person"
              className="h-full"
              action={ctx.canManage && <Link href="/app/salespeople" className="text-sm font-medium text-pine hover:underline">Salespeople</Link>}
            >
              <div className="p-5">
                <CompareBars rows={personRows} currency={cur} />
              </div>
            </Card>
          </Reveal>
        )}
        <Reveal delay={0.05}>
          <Card title="Where your stock value sits" className="h-full">
            <div className="p-5">
              <Donut parts={donut} currency={cur} />
            </div>
          </Card>
        </Reveal>
        <Reveal>
          <Card title="Busiest times" className="h-full">
            <div className="p-5">
              <Heatmap cells={cells} />
              <p className="mt-3 text-xs text-faint">Darker squares mean more sales in that hour. Useful for staffing.</p>
            </div>
          </Card>
        </Reveal>
        {/* Full width when it would otherwise sit alone on the last row. */}
        <Reveal delay={0.05} className={((storeRows.length > 1 && ctx.activeStore === "all" ? 1 : 0) + (personRows.length > 1 ? 1 : 0)) % 2 === 1 ? "lg:col-span-2" : undefined}>
          <Card title="Slow movers" className="h-full">
            <ul className="divide-y divide-line">
              {slow.map((r) => (
                <li key={r.product.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/app/products/${r.product.id}`} className="truncate font-medium hover:text-pine">
                    {r.product.name}
                  </Link>
                  <span className="shrink-0 text-muted tnum">
                    {qty(r.sold)} sold · {qty(r.onHand)} on hand
                  </span>
                </li>
              ))}
            </ul>
            <p className="px-5 pb-4 text-xs text-faint">Stock that isn&rsquo;t moving ties up cash. Consider a promotion or a transfer.</p>
          </Card>
        </Reveal>
      </div>

      <Reveal className="mt-6">
        <Card title={`Best sellers, ${days} days`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-sunk">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Product</th>
                  <th className={cn(th, "text-right")}>Units</th>
                  <th className={cn(th, "text-right")}>Revenue</th>
                  <th className={cn(th, "text-right")}>Profit</th>
                  <th className={cn(th, "text-right")}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {best.map((r, i) => (
                  <tr key={r.product!.id} className="border-t border-line">
                    <td className={cn(td, "text-faint tnum")}>{i + 1}</td>
                    <td className={td}>
                      <Link href={`/app/products/${r.product!.id}`} className="font-medium hover:text-pine">
                        {r.product!.name}
                      </Link>
                    </td>
                    <td className={cn(td, "text-right tnum")}>{qty(r.units)}</td>
                    <td className={cn(td, "text-right font-semibold tnum")}>{money(r.revenue, cur)}</td>
                    <td className={cn(td, "text-right text-ok tnum")}>{money(r.profit, cur)}</td>
                    <td className={cn(td, "text-right tnum text-muted")}>{r.revenue ? Math.round((r.profit / r.revenue) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {best.length === 0 && <p className="px-5 py-10 text-center text-muted">No sales in this period.</p>}
          </div>
        </Card>
      </Reveal>
    </>
  );
}
