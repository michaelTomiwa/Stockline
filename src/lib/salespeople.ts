import "server-only";
import type { Context } from "./context";
import { lagosStartOf } from "./dates";
import { num, type Member, type Store } from "./types";

export type SalesStats = { revenue: number; cost: number; units: number; orders: number };
export type SalespersonRow = Member & {
  store: Store | null;
  today: SalesStats;
  month: SalesStats;
  commission: number; // earned so far this month
  targetPct: number | null;
  manageable: boolean;
};

const EMPTY: SalesStats = { revenue: 0, cost: 0, units: 0, orders: 0 };

type RawStats = { user_id: string; revenue: unknown; cost: unknown; units: unknown; orders: unknown };
function statsMap(rows: unknown) {
  return new Map(
    ((rows ?? []) as RawStats[]).map((r) => [r.user_id, { revenue: num(r.revenue), cost: num(r.cost), units: num(r.units), orders: num(r.orders) }]),
  );
}

/* Owners manage every salesperson; a manager only those at their own store. */
export function canManageSalesperson(ctx: Context, storeId: string | null) {
  if (ctx.isOwner) return true;
  if (ctx.member.role !== "manager") return false;
  return !ctx.member.store_id || ctx.member.store_id === storeId;
}

/* Stores a salesperson can be put in by this person, and whether "All stores" is allowed. */
export function assignableStores(ctx: Context) {
  const all = ctx.isOwner || (ctx.member.role === "manager" && !ctx.member.store_id);
  return { stores: all ? ctx.stores : ctx.stores.filter((s) => s.id === ctx.member.store_id), allowAllStores: all };
}

export async function loadSalespeople(ctx: Context, opts: { scopeToActiveStore?: boolean } = {}) {
  const [{ data }, monthRes, todayRes] = await Promise.all([
    ctx.supabase.from("members").select("*").eq("role", "sales").order("full_name"),
    ctx.supabase.rpc("sales_by_person", { p_since: lagosStartOf("month"), p_store: null }),
    ctx.supabase.rpc("sales_by_person", { p_since: lagosStartOf("day"), p_store: null }),
  ]);
  const month = statsMap(monthRes.data);
  const today = statsMap(todayRes.data);
  const storeById = new Map(ctx.stores.map((s) => [s.id, s]));

  let rows: SalespersonRow[] = ((data ?? []) as Member[]).map((m) => {
    const mStats = month.get(m.user_id) ?? EMPTY;
    const target = num(m.monthly_target);
    return {
      ...m,
      monthly_target: target || null,
      commission_rate: num(m.commission_rate),
      store: m.store_id ? (storeById.get(m.store_id) ?? null) : null,
      today: today.get(m.user_id) ?? EMPTY,
      month: mStats,
      commission: (mStats.revenue * num(m.commission_rate)) / 100,
      targetPct: target ? (mStats.revenue / target) * 100 : null,
      manageable: canManageSalesperson(ctx, m.store_id),
    };
  });
  if (opts.scopeToActiveStore && ctx.activeStore !== "all") {
    rows = rows.filter((r) => !r.store_id || r.store_id === ctx.activeStore);
  }
  // Best this month first; people who are switched off go last.
  rows.sort((a, b) => Number(b.active) - Number(a.active) || b.month.revenue - a.month.revenue);
  return rows;
}
