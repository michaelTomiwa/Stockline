import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { lastDays } from "@/lib/dates";
import { cn, fullDate, money, qty, timeAgo } from "@/lib/format";
import { MOVEMENT_LABEL, ROLE_LABEL, num, type MovementType, type Role } from "@/lib/types";
import { Card, StoreDot, td, th } from "@/components/ui";
import { FadeIn, Reveal } from "@/components/motion";
import { RevenueChart } from "@/components/charts";

export const metadata = { title: "Business" };

type Detail = {
  business: { id: string; name: string; currency: string; created_at: string; owner_email: string | null };
  stores: { id: string; name: string; address: string | null; color: string; archived: boolean; stock_value: unknown; low: unknown; sales_30d: unknown }[];
  people: {
    user_id: string;
    full_name: string | null;
    role: Role;
    username: string | null;
    email: string | null;
    store_id: string | null;
    active: boolean;
    phone: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    monthly_target: unknown;
    commission_rate: unknown;
    sales_30d: unknown;
    orders_30d: unknown;
  }[];
  counts: { products: number; suppliers: number; movements: number };
  daily: { day: string; revenue: unknown; cost: unknown; orders: unknown }[];
  recent: { id: string; type: MovementType; quantity: unknown; unit_price: unknown; created_at: string; product: string; store: string; store_color: string; person: string }[];
};

export default async function AdminBusinessPage({ params }: PageProps<"/admin/businesses/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_business", { p_id: id });
  if (error || !data) notFound();
  const d = data as Detail;
  const cur = d.business.currency;

  const byDay = new Map(d.daily.map((x) => [x.day, x]));
  const series = lastDays(30).map((date) => {
    const x = byDay.get(date);
    return { day: date, revenue: num(x?.revenue), profit: num(x?.revenue) - num(x?.cost), orders: num(x?.orders) };
  });
  const storeById = new Map(d.stores.map((s) => [s.id, s]));
  const stockValue = d.stores.reduce((s, x) => s + num(x.stock_value), 0);
  const sales30 = series.reduce((s, x) => s + x.revenue, 0);
  const salespeople = d.people.filter((p) => p.role === "sales");

  return (
    <>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> All businesses
      </Link>
      <FadeIn className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{d.business.name}</h1>
        <p className="mt-1 text-muted">
          Owner {d.business.owner_email ?? "unknown"} · joined {fullDate(d.business.created_at)}
        </p>
      </FadeIn>

      <FadeIn delay={0.05} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Stores", value: String(d.stores.filter((s) => !s.archived).length) },
          { label: "Products", value: String(d.counts.products) },
          { label: "People", value: String(d.people.length), sub: `${salespeople.length} salespeople` },
          { label: "Suppliers", value: String(d.counts.suppliers) },
          { label: "Stock value", value: money(stockValue, cur), sub: "at cost" },
          { label: "Sales, 30 days", value: money(sales30, cur), sub: `${qty(d.counts.movements)} movements in total` },
        ].map((s) => (
          <div key={s.label} className="bg-panel p-4 sm:p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-xl font-bold tnum">{s.value}</p>
            {s.sub && <p className="mt-0.5 text-xs text-faint">{s.sub}</p>}
          </div>
        ))}
      </FadeIn>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <Reveal>
          <Card className="p-5">
            <RevenueChart data={series} currency={cur} />
          </Card>
        </Reveal>
        <Reveal delay={0.05}>
          <Card title="Stores" className="h-full">
            <ul className="divide-y divide-line">
              {d.stores.map((s) => (
                <li key={s.id} className={cn("px-5 py-3", s.archived && "opacity-50")}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 font-semibold">
                      <StoreDot color={s.color} />
                      {s.name}
                      {s.archived && <span className="text-xs font-normal text-faint">archived</span>}
                    </span>
                    <span className="text-sm tnum">{money(num(s.sales_30d), cur)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted tnum">
                    {money(num(s.stock_value), cur)} in stock · <span className={num(s.low) ? "text-low" : ""}>{num(s.low)} low or out</span>
                    {s.address && <> · {s.address}</>}
                  </p>
                </li>
              ))}
              {d.stores.length === 0 && <li className="px-5 py-8 text-center text-muted">No stores yet.</li>}
            </ul>
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card title={`People (${d.people.length})`} className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-sunk">
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Role</th>
                  <th className={th}>Signs in with</th>
                  <th className={th}>Store</th>
                  <th className={cn(th, "text-right")}>Sales, 30 days</th>
                  <th className={th}>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {d.people.map((p) => {
                  const st = p.store_id ? storeById.get(p.store_id) : null;
                  return (
                    <tr key={p.user_id} className={cn("border-t border-line", !p.active && "opacity-55")}>
                      <td className={td}>
                        <span className="font-medium">{p.full_name || "—"}</span>
                        {!p.active && <span className="ml-2 rounded-full bg-out/10 px-2 py-0.5 text-[11px] font-semibold text-out">Off</span>}
                        {p.phone && <span className="block text-xs text-faint">{p.phone}</span>}
                      </td>
                      <td className={td}>{ROLE_LABEL[p.role] ?? p.role}</td>
                      <td className={cn(td, p.username && "font-mono text-[13px]")}>{p.username ?? p.email ?? "—"}</td>
                      <td className={td}>
                        {st ? (
                          <span className="flex items-center gap-2">
                            <StoreDot color={st.color} className="size-2" />
                            {st.name}
                          </span>
                        ) : (
                          <span className="text-muted">All stores</span>
                        )}
                      </td>
                      <td className={cn(td, "text-right tnum")}>
                        {money(num(p.sales_30d), cur)}
                        <span className="block text-xs text-faint">{num(p.orders_30d)} sales</span>
                      </td>
                      <td className={cn(td, "whitespace-nowrap text-muted")}>{p.last_sign_in_at ? timeAgo(p.last_sign_in_at) : "Never"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>

      <Reveal>
        <Card title="Latest activity" className="mt-6">
          <ul className="divide-y divide-line">
            {d.recent.map((m) => {
              const q = num(m.quantity);
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className={cn("w-12 shrink-0 text-right font-semibold tnum", q > 0 ? "text-ok" : "text-ink")}>
                    {q > 0 ? "+" : "−"}
                    {qty(Math.abs(q))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.product}</span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-faint">
                      <StoreDot color={m.store_color} className="size-1.5" />
                      {MOVEMENT_LABEL[m.type]} · {m.store} · {m.person}
                    </span>
                  </span>
                  {m.type === "sale" && <span className="shrink-0 tnum text-muted">{money(-q * num(m.unit_price), cur)}</span>}
                  <span className="w-24 shrink-0 text-right text-xs text-faint">{timeAgo(m.created_at)}</span>
                </li>
              );
            })}
            {d.recent.length === 0 && <li className="px-5 py-8 text-center text-muted">Nothing recorded yet.</li>}
          </ul>
        </Card>
      </Reveal>
    </>
  );
}
