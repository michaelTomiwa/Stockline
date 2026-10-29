import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/types";
import { money, shortDate } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { FadeIn, Reveal } from "@/components/motion";
import { RevenueChart } from "@/components/charts";
import { AdminBusinessTable, AdminList, type AdminBusiness } from "@/components/admin";

export const metadata = { title: "Overview" };

export default async function AdminHome() {
  const supabase = await createClient();
  const [bizRes, dailyRes, adminsRes] = await Promise.all([
    supabase.rpc("admin_businesses"),
    supabase.rpc("admin_daily", { p_days: 30 }),
    supabase.rpc("admin_list"),
  ]);

  const businesses: AdminBusiness[] = ((bizRes.data ?? []) as Record<string, unknown>[]).map((b) => ({
    id: String(b.id),
    name: String(b.name),
    currency: String(b.currency ?? "NGN"),
    created_at: String(b.created_at),
    owner_name: (b.owner_name as string) ?? null,
    owner_email: (b.owner_email as string) ?? null,
    stores: num(b.stores),
    products: num(b.products),
    people: num(b.people),
    salespeople: num(b.salespeople),
    stock_value: num(b.stock_value),
    sales_today: num(b.sales_today),
    sales_30d: num(b.sales_30d),
    orders_30d: num(b.orders_30d),
    last_activity: (b.last_activity as string) ?? null,
  }));
  const daily = ((dailyRes.data ?? []) as { day: string; signups: unknown; revenue: unknown; orders: unknown }[]).map((d) => ({
    day: d.day,
    signups: num(d.signups),
    revenue: num(d.revenue),
    orders: num(d.orders),
  }));

  const sum = (f: (b: AdminBusiness) => number) => businesses.reduce((s, b) => s + f(b), 0);
  const newThisWeek = daily.slice(-7).reduce((s, d) => s + d.signups, 0);
  const activeThisWeek = businesses.filter((b) => b.last_activity && daily.length && b.last_activity.slice(0, 10) >= daily[Math.max(0, daily.length - 7)].day).length;
  const signupsMax = Math.max(1, ...daily.map((d) => d.signups));

  return (
    <>
      <PageHeader title="Everything on Stockline" description="Every business, its stores, people and sales. Click a business for the full picture." />

      <FadeIn className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Businesses", value: String(businesses.length), sub: `${newThisWeek} new this week` },
          { label: "Active this week", value: String(activeThisWeek), sub: "recorded stock or sales" },
          { label: "Stores", value: String(sum((b) => b.stores)), sub: `${sum((b) => b.products)} products` },
          { label: "People", value: String(sum((b) => b.people)), sub: `${sum((b) => b.salespeople)} salespeople` },
          { label: "Sales today", value: money(sum((b) => b.sales_today)), sub: "all businesses" },
          { label: "Sales, 30 days", value: money(sum((b) => b.sales_30d)), sub: `${sum((b) => b.orders_30d)} sales` },
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
            <RevenueChart data={daily.map((d) => ({ day: d.day, revenue: d.revenue, profit: 0, orders: d.orders }))} currency="NGN" showProfit={false} />
          </Card>
        </Reveal>
        <Reveal delay={0.05}>
          <Card title="New businesses, 30 days" className="h-full">
            <div className="p-5">
              <p className="text-2xl font-bold tnum">{daily.reduce((s, d) => s + d.signups, 0)}</p>
              <div className="mt-4 flex h-32 items-end gap-[3px]" role="img" aria-label="New businesses per day">
                {daily.map((d) => (
                  <div key={d.day} className="group relative flex-1">
                    <div
                      className={d.signups ? "rounded-t bg-pine" : "rounded-t bg-sunk"}
                      style={{ height: `${d.signups ? Math.max(8, (d.signups / signupsMax) * 128) : 4}px` }}
                    />
                    <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-night px-1.5 py-0.5 text-[11px] text-white group-hover:block">
                      {shortDate(d.day)}: {d.signups}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-faint">
                <span>{daily[0] && shortDate(daily[0].day)}</span>
                <span>Today</span>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card title={`Businesses (${businesses.length})`} className="mt-6">
          <AdminBusinessTable rows={businesses} />
        </Card>
      </Reveal>

      <Reveal>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <Card title="Admins">
            <AdminList admins={(adminsRes.data ?? []) as { email: string; added_at: string; is_you: boolean }[]} />
          </Card>
          <Card title="What admins can see">
            <ul className="space-y-2 p-5 text-sm text-muted">
              <li>Every business: owner, stores, products, team, stock value and sales.</li>
              <li>Each business&rsquo;s people, including salespeople, their logins and their sales.</li>
              <li>The latest stock movements in each business.</li>
              <li className="text-faint">This area is read-only: you can look, but changes happen inside each business.</li>
            </ul>
          </Card>
        </div>
      </Reveal>
    </>
  );
}
