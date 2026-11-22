import "server-only";
import { getContext, isSampleStore, operatingStore } from "./context";
import { loadCatalog, loadLevels } from "./inventory";

/* Everything the sell / receive / transfer / count screens need. */
export async function loadStockPage() {
  const ctx = await getContext();
  const [{ products, categories, suppliers }, levels] = await Promise.all([
    loadCatalog(ctx),
    loadLevels(ctx, ctx.stores.map((s) => s.id)),
  ]);
  const map: Record<string, number> = {};
  const perStore: Record<string, number> = {};
  for (const l of levels) {
    map[`${l.store_id}:${l.product_id}`] = l.quantity;
    if (l.quantity > 0) perStore[l.store_id] = (perStore[l.store_id] ?? 0) + 1;
  }
  // With "All stores" picked, open on the store that actually holds the most products.
  const busiest = ctx.stores.filter((s) => !isSampleStore(s)).sort((a, b) => (perStore[b.id] ?? 0) - (perStore[a.id] ?? 0))[0];
  const defaultStore = ctx.activeStore === "all" ? (busiest?.id ?? operatingStore(ctx)) : operatingStore(ctx);
  return {
    ctx,
    props: {
      products,
      categories,
      suppliers,
      stores: ctx.stores,
      levels: map,
      defaultStore: defaultStore ?? "",
      currency: ctx.business.currency,
    },
  };
}
