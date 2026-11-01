import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getContext } from "@/lib/context";
import { assignableStores } from "@/lib/salespeople";
import { lagosToday, monthRange } from "@/lib/dates";
import { cn, fullDate, money } from "@/lib/format";
import { num } from "@/lib/types";
import { Card, PageHeader, StoreDot, td, th } from "@/components/ui";
import { FadeIn, Reveal } from "@/components/motion";
import { AddExpenseButton, VoidExpense } from "@/components/expense-form";

export const metadata = { title: "Expenses & profit" };

type Expense = { id: string; store_id: string | null; category: string; amount: unknown; spent_on: string; note: string | null; voided: boolean };
type PL = { store_id: string | null; revenue: unknown; cogs: unknown; losses: unknown; expenses: unknown; orders: unknown };

export default async function ExpensesPage({ searchParams }: PageProps<"/app/expenses">) {
  const ctx = await getContext();
  if (!ctx.canManage) notFound();
  const cur = ctx.business.currency;
  const sp = await searchParams;
  const month = monthRange(typeof sp.month === "string" ? sp.month : undefined);

  const [plRes, expRes] = await Promise.all([
    ctx.supabase.rpc("profit_and_loss", { p_from: month.from, p_to: month.to }),
    ctx.supabase.from("expenses").select("*").gte("spent_on", month.from).lte("spent_on", month.to).order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const pl = ((plRes.data ?? []) as PL[]).map((r) => ({
    store_id: r.store_id,
    revenue: num(r.revenue),
    cogs: num(r.cogs),
    losses: num(r.losses),
    expenses: num(r.expenses),
    orders: num(r.orders),
  }));
  const expenses = (expRes.data ?? []) as Expense[];
  const storeById = new Map(ctx.stores.map((s) => [s.id, s]));
  const { stores, allowAllStores } = assignableStores(ctx);

  // Only stores this person can see, plus business-wide costs.
  const rows = pl.filter((r) => r.store_id === null || storeById.has(r.store_id));
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const revenue = sum((r) => r.revenue);
  const cogs = sum((r) => r.cogs);
  const losses = sum((r) => r.losses);
  const spent = sum((r) => r.expenses);
  const gross = revenue - cogs;
  const net = gross - losses - spent;

  const byCategory = new Map<string, number>();
  for (const e of expenses) if (!e.voided) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + num(e.amount));
  const cats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(1, ...cats.map((c) => c[1]));

  const storeRows = [
    ...ctx.stores.map((s) => ({ key: s.id, store: s, ...(rows.find((r) => r.store_id === s.id) ?? { revenue: 0, cogs: 0, losses: 0, expenses: 0, orders: 0 }) })),
    ...rows.filter((r) => r.store_id === null).map((r) => ({ key: "business", store: null, ...r })),
  ];

  return (
    <>
      <PageHeader
        title="Expenses & profit"
        description="What came in, what it cost you, and what's left after running the business."
        actions={
          <>
            <div className="flex items-center rounded-xl border border-line bg-panel text-sm">
              <Link href={`/app/expenses?month=${month.prev}`} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Previous month">
                <ChevronLeft size={16} />
              </Link>
              <span className="min-w-32 text-center font-semibold">{month.label}</span>
              {month.next ? (
                <Link href={`/app/expenses?month=${month.next}`} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Next month">
                  <ChevronRight size={16} />
                </Link>
              ) : (
                <span className="grid size-10 place-items-center text-line">
                  <ChevronRight size={16} />
                </span>
              )}
            </div>
            <AddExpenseButton
              businessId={ctx.business.id}
              stores={stores}
              allowBusinessWide={allowAllStores}
              defaultStore={ctx.activeStore !== "all" ? ctx.activeStore : undefined}
              today={lagosToday()}
            />
          </>
        }
      />

      {/* The money story, left to right */}
      <FadeIn className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-5">
          {[
            { label: "Sales", value: revenue, sub: `${sum((r) => r.orders)} sales` },
            { label: "Cost of goods sold", value: -cogs, sub: "what the items cost you" },
            { label: "Gross profit", value: gross, sub: revenue ? `${Math.round((gross / revenue) * 100)}% of sales` : "—" },
            { label: "Expenses + losses", value: -(spent + losses), sub: `${money(spent, cur)} spent · ${money(losses, cur)} damaged/lost` },
          ].map((s) => (
            <div key={s.label} className="bg-panel p-4 sm:p-5">
              <p className="text-sm text-muted">{s.label}</p>
              <p className={cn("mt-1 text-xl font-bold tnum", s.value < 0 && "text-muted")}>
                {s.value < 0 ? "−" : ""}
                {money(Math.abs(s.value), cur)}
              </p>
              <p className="mt-0.5 text-xs text-faint">{s.sub}</p>
            </div>
          ))}
          <div className={cn("col-span-2 p-4 sm:p-5 md:col-span-1", net >= 0 ? "bg-night text-white" : "bg-out/10")}>
            <p className={cn("text-sm", net >= 0 ? "text-white/60" : "text-out")}>Net profit</p>
            <p className={cn("mt-1 text-2xl font-bold tnum", net >= 0 ? "text-citrus" : "text-out")}>
              {net < 0 ? "−" : ""}
              {money(Math.abs(net), cur)}
            </p>
            <p className={cn("mt-0.5 text-xs", net >= 0 ? "text-white/50" : "text-out/80")}>
              {month.isCurrent ? "so far this month" : month.label}
            </p>
          </div>
        </div>
      </FadeIn>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <Reveal>
          <Card title="By store">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-sunk">
                  <tr>
                    <th className={th}>Store</th>
                    <th className={cn(th, "text-right")}>Sales</th>
                    <th className={cn(th, "text-right")}>Gross profit</th>
                    <th className={cn(th, "text-right")}>Expenses</th>
                    <th className={cn(th, "text-right")}>Losses</th>
                    <th className={cn(th, "text-right")}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {storeRows.map((r) => {
                    const n = r.revenue - r.cogs - r.losses - r.expenses;
                    return (
                      <tr key={r.key} className="border-t border-line">
                        <td className={td}>
                          {r.store ? (
                            <span className="flex items-center gap-2 font-medium">
                              <StoreDot color={r.store.color} />
                              {r.store.name}
                            </span>
                          ) : (
                            <span className="font-medium text-muted">Whole business</span>
                          )}
                        </td>
                        <td className={cn(td, "text-right tnum")}>{money(r.revenue, cur)}</td>
                        <td className={cn(td, "text-right tnum")}>{money(r.revenue - r.cogs, cur)}</td>
                        <td className={cn(td, "text-right tnum text-muted")}>{r.expenses ? `−${money(r.expenses, cur)}` : "—"}</td>
                        <td className={cn(td, "text-right tnum text-muted")}>{r.losses ? `−${money(r.losses, cur)}` : "—"}</td>
                        <td className={cn(td, "text-right font-semibold tnum", n < 0 ? "text-out" : "text-ok")}>
                          {n < 0 ? "−" : ""}
                          {money(Math.abs(n), cur)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-5 py-3 text-xs text-faint">
              Losses are stock written off in counts (damaged, expired, lost) at cost price. &ldquo;Whole business&rdquo; holds costs that aren&rsquo;t
              for one store.
            </p>
          </Card>
        </Reveal>
        <Reveal delay={0.05}>
          <Card title="Where the money went" className="h-full">
            {cats.length === 0 ? (
              <p className="px-5 py-10 text-center text-muted">No expenses for {month.label} yet.</p>
            ) : (
              <ul className="space-y-3 px-5 py-4">
                {cats.map(([c, v]) => (
                  <li key={c}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium">{c}</span>
                      <span className="tnum">{money(v, cur)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-sunk">
                      <div className="h-full rounded-full bg-low" style={{ width: `${(v / catMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card title={`Expenses in ${month.label} (${expenses.filter((e) => !e.voided).length})`} className="mt-6">
          {expenses.length === 0 ? (
            <p className="px-5 py-12 text-center text-muted">
              Add rent, salaries, fuel, transport and anything else you pay for, and your real profit shows up above.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {expenses.map((e) => {
                const st = e.store_id ? storeById.get(e.store_id) : null;
                return (
                  <li key={e.id} className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm", e.voided && "opacity-50")}>
                    <span className="min-w-0">
                      <span className={cn("font-medium", e.voided && "line-through")}>{e.category}</span>
                      <span className="block text-xs text-faint">
                        {fullDate(e.spent_on)} · {st ? st.name : "Whole business"}
                        {e.note && <> · {e.note}</>}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold tnum">{money(num(e.amount), cur)}</span>
                      <VoidExpense id={e.id} voided={e.voided} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Reveal>
    </>
  );
}
