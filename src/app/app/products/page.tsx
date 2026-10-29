import { Suspense } from "react";
import { getContext } from "@/lib/context";
import { loadCatalog, loadLevels, scopeStoreIds } from "@/lib/inventory";
import { stockStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { ProductsView, type ProductRow } from "@/components/products-view";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const ctx = await getContext();
  const storeIds = scopeStoreIds(ctx);
  const stores = ctx.stores.filter((s) => storeIds.includes(s.id));
  const [{ products, categories, suppliers }, levels] = await Promise.all([loadCatalog(ctx), loadLevels(ctx, storeIds)]);

  const rows: ProductRow[] = products.map((p) => {
    const perStore: Record<string, number> = {};
    for (const l of levels) if (l.product_id === p.id) perStore[l.store_id] = l.quantity;
    const total = Object.values(perStore).reduce((s, v) => s + v, 0);
    // A product is "low" if any store in view is low; "out" if every store is out.
    const statuses = stores.map((s) => stockStatus(perStore[s.id] ?? 0, p.reorder_level));
    const status = statuses.length && statuses.every((s) => s === "out") ? "out" : statuses.some((s) => s !== "ok") ? "low" : "ok";
    return { ...p, perStore, total, status };
  });

  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.length} products${stores.length === 1 ? ` at ${stores[0].name}` : ` across ${stores.length} stores`}.`}
      />
      <Suspense>
        <ProductsView
          rows={rows}
          stores={stores}
          categories={categories}
          suppliers={suppliers}
          businessId={ctx.business.id}
          currency={ctx.business.currency}
          canManage={ctx.canManage}
        />
      </Suspense>
    </>
  );
}
