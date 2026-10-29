import "server-only";
import { getContext, operatingStore } from "./context";
import { loadCatalog, loadLevels } from "./inventory";

/* Everything the sell / receive / transfer / count screens need. */
export async function loadStockPage() {
  const ctx = await getContext();
  const [{ products, categories, suppliers }, levels] = await Promise.all([
    loadCatalog(ctx),
    loadLevels(ctx, ctx.stores.map((s) => s.id)),
  ]);
  const map: Record<string, number> = {};
  for (const l of levels) map[`${l.store_id}:${l.product_id}`] = l.quantity;
  return {
    ctx,
    props: {
      products,
      categories,
      suppliers,
      stores: ctx.stores,
      levels: map,
      defaultStore: operatingStore(ctx) ?? "",
      currency: ctx.business.currency,
    },
  };
}
