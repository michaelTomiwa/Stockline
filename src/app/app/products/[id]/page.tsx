import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadCatalog, loadLevels, scopeStoreIds, suggestedOrder } from "@/lib/inventory";
import { loadPeople } from "@/lib/people";
import { num, stockStatus, type Movement } from "@/lib/types";
import { cn, money, qty } from "@/lib/format";
import { Card, StatusBadge, StoreDot, td, th } from "@/components/ui";
import { MovementTable } from "@/components/movement-list";
import { ProductActions } from "@/components/product-actions";
import { FadeIn } from "@/components/motion";

export default async function ProductPage({ params }: PageProps<"/app/products/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  const cur = ctx.business.currency;
  const storeIds = scopeStoreIds(ctx);
  const [{ products, categories, suppliers }, levels, people, movesRes, salesRes] = await Promise.all([
    loadCatalog(ctx),
    loadLevels(ctx, ctx.stores.map((s) => s.id)),
    loadPeople(ctx),
    ctx.supabase.from("movements").select("*").eq("product_id", id).in("store_id", storeIds).order("created_at", { ascending: false }).limit(60),
    ctx.supabase.rpc("product_sales", { p_days: 30, p_store: ctx.activeStore === "all" ? null : ctx.activeStore }),
  ]);
  const product = products.find((p) => p.id === id);
  if (!product) notFound();

  const per = ctx.stores.map((s) => {
    const q = levels.find((l) => l.store_id === s.id && l.product_id === id)?.quantity ?? 0;
    return { store: s, quantity: q, status: stockStatus(q, product.reorder_level) };
  });
  const inScope = per.filter((p) => storeIds.includes(p.store.id));
  const total = inScope.reduce((s, p) => s + p.quantity, 0);
  const sold = ((salesRes.data ?? []) as { product_id: string; units: unknown; revenue: unknown }[]).find((r) => r.product_id === id);
  const margin = product.sell_price > 0 ? Math.round(((product.sell_price - product.cost_price) / product.sell_price) * 100) : 0;
  const category = categories.find((c) => c.id === product.category_id)?.name;
  const supplier = suppliers.find((s) => s.id === product.supplier_id);

  return (
    <>
      <Link href="/app/products" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Products
      </Link>
      <FadeIn className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{product.name}</h1>
          <p className="mt-1 text-muted">
            <span className="font-mono text-sm">{product.sku}</span>
            {product.barcode && <span className="font-mono text-sm"> · {product.barcode}</span>}
            {category && <> · {category}</>}
            {supplier && <> · from {supplier.name}</>}
          </p>
        </div>
        {ctx.canManage && (
          <div className="flex gap-2">
            <ProductActions product={product} categories={categories} suppliers={suppliers} businessId={ctx.business.id} />
          </div>
        )}
      </FadeIn>

      <FadeIn delay={0.05} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: "On hand", value: `${qty(total)} ${product.unit}`, sub: `Reorder at ${qty(product.reorder_level)} per store` },
          { label: "Stock value", value: money(total * product.cost_price, cur), sub: `${money(total * product.sell_price, cur)} at selling price` },
          { label: "Price", value: money(product.sell_price, cur), sub: `Cost ${money(product.cost_price, cur)} · ${margin}% margin` },
          { label: "Sold, 30 days", value: `${qty(num(sold?.units))} ${product.unit}`, sub: money(num(sold?.revenue), cur) },
        ].map((s) => (
          <div key={s.label} className="bg-panel p-4 sm:p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-xl font-bold tnum">{s.value}</p>
            <p className="mt-0.5 text-xs text-faint">{s.sub}</p>
          </div>
        ))}
      </FadeIn>

      <Card title="By store" className="mt-6">
        <table className="w-full text-sm">
          <thead className="bg-sunk">
            <tr>
              <th className={th}>Store</th>
              <th className={cn(th, "text-right")}>On hand</th>
              <th className={cn(th, "text-right")}>Suggested order</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {per.map((p) => (
              <tr key={p.store.id} className="border-t border-line">
                <td className={td}>
                  <span className="flex items-center gap-2 font-medium">
                    <StoreDot color={p.store.color} />
                    {p.store.name}
                  </span>
                </td>
                <td className={cn(td, "text-right font-semibold tnum")}>{qty(p.quantity)}</td>
                <td className={cn(td, "text-right tnum text-muted")}>
                  {p.status === "ok" ? "—" : `+${qty(suggestedOrder(p.quantity, product.reorder_level))}`}
                </td>
                <td className={td}>
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="History" className="mt-6">
        {(movesRes.data ?? []).length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">No movements yet. Receive some stock to get started.</p>
        ) : (
          <MovementTable
            rows={(movesRes.data ?? []) as Movement[]}
            products={new Map(products.map((p) => [p.id, p]))}
            stores={new Map(ctx.stores.map((s) => [s.id, s]))}
            suppliers={new Map(suppliers.map((s) => [s.id, s]))}
            people={people}
            currency={cur}
            hideProduct
          />
        )}
      </Card>
    </>
  );
}
