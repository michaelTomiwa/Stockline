import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadCatalog, loadLevels, stockGrid, suggestedOrder, totals } from "@/lib/inventory";
import { loadPeople } from "@/lib/people";
import { num, type Movement } from "@/lib/types";
import { cn, money, qty } from "@/lib/format";
import { Card, StatusBadge, td, th } from "@/components/ui";
import { MovementTable } from "@/components/movement-list";
import { StoreButton } from "@/components/store-form";
import { FadeIn } from "@/components/motion";

export default async function StorePage({ params }: PageProps<"/app/stores/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  const store = ctx.stores.find((s) => s.id === id);
  if (!store) notFound();
  const cur = ctx.business.currency;

  const [{ products, suppliers }, levels, people, movesRes, salesRes] = await Promise.all([
    loadCatalog(ctx),
    loadLevels(ctx, [id]),
    loadPeople(ctx),
    ctx.supabase.from("movements").select("*").eq("store_id", id).order("created_at", { ascending: false }).limit(25),
    ctx.supabase.rpc("store_sales", { p_days: 30 }),
  ]);
  const grid = stockGrid(products, [store], levels);
  const t = totals(grid);
  const s30 = ((salesRes.data ?? []) as { store_id: string; revenue: unknown; profit: unknown; orders: unknown }[]).find((r) => r.store_id === id);
  const attention = grid.filter((r) => r.status !== "ok").sort((a, b) => a.quantity - b.quantity);

  return (
    <>
      <Link href="/app/stores" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Stores
      </Link>
      <FadeIn className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-10 w-1.5 rounded-full" style={{ background: store.color }} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{store.name}</h1>
            <p className="text-muted">{[store.address, store.phone].filter(Boolean).join(" · ") || "No address yet"}</p>
          </div>
        </div>
        {ctx.isOwner && <StoreButton store={store} businessId={ctx.business.id} />}
      </FadeIn>

      <FadeIn delay={0.05} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: "Stock value", value: money(t.cost, cur), sub: `${money(t.retail, cur)} at selling price` },
          { label: "Units on hand", value: qty(t.units), sub: `${products.length} products` },
          { label: "Sales, 30 days", value: money(num(s30?.revenue), cur), sub: `${num(s30?.orders)} sales · ${money(num(s30?.profit), cur)} profit` },
          { label: "Need attention", value: String(t.low + t.out), sub: `${t.out} out · ${t.low} low` },
        ].map((s) => (
          <div key={s.label} className="bg-panel p-4 sm:p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-xl font-bold tnum">{s.value}</p>
            <p className="mt-0.5 text-xs text-faint">{s.sub}</p>
          </div>
        ))}
      </FadeIn>

      <Card title="Low and out of stock" className="mt-6">
        {attention.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted">Everything here is above its reorder level.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-sunk">
                <tr>
                  <th className={th}>Product</th>
                  <th className={cn(th, "text-right")}>On hand</th>
                  <th className={cn(th, "text-right")}>Suggested order</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((r) => (
                  <tr key={r.product.id} className="border-t border-line">
                    <td className={td}>
                      <Link href={`/app/products/${r.product.id}`} className="font-medium hover:text-pine">
                        {r.product.name}
                      </Link>
                    </td>
                    <td className={cn(td, "text-right tnum")}>
                      {qty(r.quantity)} <span className="text-faint">/ {qty(r.product.reorder_level)}</span>
                    </td>
                    <td className={cn(td, "text-right font-semibold tnum")}>+{qty(suggestedOrder(r.quantity, r.product.reorder_level))}</td>
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

      <Card title="Recent activity" className="mt-6" action={<Link href={`/app/movements?store=${id}`} className="text-sm font-medium text-pine hover:underline">Full history</Link>}>
        <MovementTable
          rows={(movesRes.data ?? []) as Movement[]}
          products={new Map(products.map((p) => [p.id, p]))}
          stores={new Map(ctx.stores.map((s) => [s.id, s]))}
          suppliers={new Map(suppliers.map((s) => [s.id, s]))}
          people={people}
          currency={cur}
        />
      </Card>
    </>
  );
}
