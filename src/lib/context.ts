import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Role, Store } from "./types";

export const STORE_COOKIE = "stockline_store";

/*
  Everything a signed-in page needs: the person, their business, the stores
  they're allowed to see and which one is selected ("all" = every store).
  Cached per request so layouts and pages share one lookup.
*/
export const getContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase.from("members").select("*").eq("user_id", user.id).maybeSingle();
  if (!member) redirect("/login?error=no-business");

  const [{ data: business }, { data: storeRows }] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", member.business_id).single(),
    supabase.from("stores").select("*").eq("archived", false).order("created_at").order("name"),
  ]);

  const role = member.role as Role;
  const all = (storeRows ?? []) as Store[];
  const stores = role === "owner" || !member.store_id ? all : all.filter((s) => s.id === member.store_id);

  const saved = (await cookies()).get(STORE_COOKIE)?.value;
  let activeStore: string = "all";
  if (saved && stores.some((s) => s.id === saved)) activeStore = saved;
  else if (stores.length === 1) activeStore = stores[0].id;

  return {
    supabase,
    user,
    member: { ...member, role } as typeof member & { role: Role },
    business: business as { id: string; name: string; currency: string },
    stores,
    activeStore,
    canManage: role === "owner" || role === "manager",
    isOwner: role === "owner",
    isSales: role === "sales",
  };
});

export type Context = Awaited<ReturnType<typeof getContext>>;

/* Salespeople only sell and look things up; other pages 404 for them. */
export async function getStockContext() {
  const ctx = await getContext();
  if (ctx.isSales) notFound();
  return ctx;
}

/* Pages that change stock need one specific store. */
export function operatingStore(ctx: Context) {
  if (ctx.activeStore !== "all") return ctx.activeStore;
  // Never default to one of the "sample data" stores when the business has a real one.
  const real = ctx.stores.find((s) => !isSampleStore(s));
  return (real ?? ctx.stores[0])?.id ?? null;
}

const SAMPLE_STORES: Record<string, string> = { Ikeja: "0803 000 1101", Lekki: "0803 000 1102", "Wuse 2": "0803 000 1103" };
export function isSampleStore(s: { name: string; phone?: string | null }) {
  return SAMPLE_STORES[s.name] !== undefined && SAMPLE_STORES[s.name] === s.phone;
}
