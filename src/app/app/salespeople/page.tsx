import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, KeyRound, MessageCircle, ShoppingCart, UserPlus } from "lucide-react";
import { getContext } from "@/lib/context";
import { assignableStores, loadSalespeople } from "@/lib/salespeople";
import { lagosMonthProgress } from "@/lib/dates";
import { cn, money } from "@/lib/format";
import { Card, PageHeader, StoreDot } from "@/components/ui";
import { FadeIn, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { AddSalespersonButton, SalespersonActions, TargetBar } from "@/components/salespeople";

export const metadata = { title: "Salespeople" };

export default async function SalespeoplePage() {
  const ctx = await getContext();
  if (!ctx.canManage) notFound();
  const cur = ctx.business.currency;
  const rows = await loadSalespeople(ctx, { scopeToActiveStore: true });
  const { stores, allowAllStores } = assignableStores(ctx);
  const { day, days, monthName } = lagosMonthProgress();
  const expected = (day / days) * 100;

  const active = rows.filter((r) => r.active);
  const today = rows.reduce((s, r) => s + r.today.revenue, 0);
  const todayOrders = rows.reduce((s, r) => s + r.today.orders, 0);
  const month = rows.reduce((s, r) => s + r.month.revenue, 0);
  const commission = rows.reduce((s, r) => s + r.commission, 0);
  const defaultStore = ctx.activeStore !== "all" ? ctx.activeStore : undefined;

  const add = <AddSalespersonButton stores={stores} allowAllStores={allowAllStores} defaultStore={defaultStore} businessName={ctx.business.name} />;

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Salespeople" description="Give the people who sell their own login." />
        <FadeIn className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="flex flex-col items-start justify-center gap-4 p-8">
            <span className="grid size-14 place-items-center rounded-2xl bg-citrus text-night">
              <UserPlus size={26} />
            </span>
            <h2 className="text-xl font-bold">Add your first salesperson</h2>
            <p className="max-w-md text-muted">
              You choose their username and password and the store they work at. They sign in on their phone, sell at your prices, and only
              ever see their own sales. You see what each person sells, how close they are to target and the commission they&rsquo;ve earned.
            </p>
            {add}
          </Card>
          <HowItWorks />
        </FadeIn>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Salespeople"
        description={<>{monthName} so far: day {day} of {days}. The thin mark on each bar is where an even pace would be today.</>}
        actions={add}
      />

      <FadeIn className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: "Salespeople", value: String(active.length), sub: rows.length > active.length ? `${rows.length - active.length} turned off` : "All active" },
          { label: "Sold by them today", value: money(today, cur), sub: `${todayOrders} ${todayOrders === 1 ? "sale" : "sales"}` },
          { label: `Sold in ${monthName}`, value: money(month, cur), sub: `${rows.reduce((s, r) => s + r.month.orders, 0)} sales` },
          { label: "Commission earned", value: money(commission, cur), sub: `${monthName}, so far` },
        ].map((s) => (
          <div key={s.label} className="bg-panel p-4 sm:p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-xl font-bold tnum sm:text-2xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-faint">{s.sub}</p>
          </div>
        ))}
      </FadeIn>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <Reveal>
          <Card title={`Leaderboard, ${monthName}`}>
            <Stagger className="divide-y divide-line">
              {rows.map((r, i) => (
                <StaggerItem key={r.user_id}>
                  <div className={cn("group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-sunk/50", !r.active && "opacity-60")}>
                    <Link href={`/app/salespeople/${r.user_id}`} className="absolute inset-0" aria-label={`Open ${r.full_name}`} />
                    <span className={cn("w-5 shrink-0 text-center text-sm font-bold tnum", i < 3 && r.active && r.month.revenue > 0 ? "text-pine" : "text-faint")}>
                      {r.active ? i + 1 : "–"}
                    </span>
                    <Avatar name={r.full_name ?? r.username ?? "?"} color={r.store?.color} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-semibold">{r.full_name}</span>
                          {!r.active && <span className="rounded-full bg-out/10 px-2 py-0.5 text-[11px] font-semibold text-out">Off</span>}
                        </p>
                        <p className="text-sm tnum">
                          <span className="font-semibold">{money(r.month.revenue, cur)}</span>
                          {r.monthly_target && <span className="text-faint"> / {money(r.monthly_target, cur)}</span>}
                        </p>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="font-mono">{r.username}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1.5">
                          {r.store ? <StoreDot color={r.store.color} className="size-2" /> : null}
                          {r.store?.name ?? "All stores"}
                        </span>
                        <span>·</span>
                        <span className="tnum">{money(r.today.revenue, cur)} today</span>
                        {r.commission_rate > 0 && (
                          <>
                            <span>·</span>
                            <span className="tnum text-ok">{money(r.commission, cur)} commission</span>
                          </>
                        )}
                      </p>
                      <TargetBar pct={r.targetPct} expectedPct={expected} className="mt-2.5" />
                    </div>
                    <ChevronRight size={16} className="hidden shrink-0 text-faint sm:block" />
                    {r.manageable && (
                      <div className="relative z-10">
                        <SalespersonActions person={r} stores={stores} allowAllStores={allowAllStores} businessName={ctx.business.name} />
                      </div>
                    )}
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </Card>
        </Reveal>
        <Reveal delay={0.05}>
          <HowItWorks />
        </Reveal>
      </div>
    </>
  );
}

function Avatar({ name, color }: { name: string; color?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: color ?? "#123d2f" }}>
      {initials}
    </span>
  );
}

function HowItWorks() {
  const steps = [
    { icon: UserPlus, title: "Create their account", body: "Pick a username and password and the store they work at. No email needed." },
    { icon: MessageCircle, title: "Send them the login", body: "One tap sends it on WhatsApp. They sign in on the normal sign-in page." },
    { icon: ShoppingCart, title: "They sell, you watch", body: "Sales are credited to them, always at your prices. They only see their own figures." },
    { icon: KeyRound, title: "Stay in control", body: "Reset a password or turn an account off at any time. Their sales history stays." },
  ];
  return (
    <Card title="How it works">
      <ol className="space-y-4 p-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sunk text-pine">
              <s.icon size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {i + 1}. {s.title}
              </p>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
