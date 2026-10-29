import "server-only";
import type { Context } from "./context";
import { num, stockStatus, type Category, type Product, type StockStatus, type Store, type Supplier } from "./types";

/* Supabase returns at most 1,000 rows per request; read in pages so big catalogues aren't cut short. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export function scopeStoreIds(ctx: Context) {
  return ctx.activeStore === "all" ? ctx.stores.map((s) => s.id) : [ctx.activeStore];
}

export async function loadCatalog(ctx: Context) {
  const [products, { data: categories }, { data: suppliers }] = await Promise.all([
    readAll<Product>((a, b) => ctx.supabase.from("products").select("*").eq("archived", false).order("name").range(a, b)),
    ctx.supabase.from("categories").select("id, name").order("name"),
    ctx.supabase.from("suppliers").select("*").order("name"),
  ]);
  return {
    products: products.map((p) => ({
      ...p,
      cost_price: num(p.cost_price),
      sell_price: num(p.sell_price),
      reorder_level: num(p.reorder_level),
    })),
    categories: (categories ?? []) as Category[],
    suppliers: (suppliers ?? []) as Supplier[],
  };
}

export type Level = { store_id: string; product_id: string; quantity: number };

export async function loadLevels(ctx: Context, storeIds: string[]) {
  if (storeIds.length === 0) return [];
  const rows = await readAll<Level>((a, b) =>
    ctx.supabase.from("stock_levels").select("store_id, product_id, quantity").in("store_id", storeIds).range(a, b),
  );
  return rows.map((r) => ({ ...r, quantity: num(r.quantity) }));
}

export type StockRow = {
  product: Product;
  store: Store;
  quantity: number;
  status: StockStatus;
};

/* One row per product per store in scope, including products a store has never stocked (quantity 0). */
export function stockGrid(products: Product[], stores: Store[], levels: Level[]): StockRow[] {
  const map = new Map(levels.map((l) => [`${l.store_id}:${l.product_id}`, l.quantity]));
  const rows: StockRow[] = [];
  for (const store of stores) {
    for (const product of products) {
      const quantity = map.get(`${store.id}:${product.id}`) ?? 0;
      rows.push({ product, store, quantity, status: stockStatus(quantity, product.reorder_level) });
    }
  }
  return rows;
}

export function totals(rows: StockRow[]) {
  let cost = 0;
  let retail = 0;
  let units = 0;
  let low = 0;
  let out = 0;
  for (const r of rows) {
    const q = Math.max(0, r.quantity);
    cost += q * r.product.cost_price;
    retail += q * r.product.sell_price;
    units += q;
    if (r.status === "low") low++;
    if (r.status === "out") out++;
  }
  return { cost, retail, units, low, out, ok: rows.length - low - out };
}

/* Suggest topping back up to twice the reorder level. */
export function suggestedOrder(quantity: number, reorder: number) {
  return Math.max(0, Math.ceil(reorder * 2 - quantity));
}
