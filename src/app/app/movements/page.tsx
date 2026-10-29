import { Suspense } from "react";
import { getContext } from "@/lib/context";
import { loadCatalog } from "@/lib/inventory";
import { loadPeople } from "@/lib/people";
import { MOVEMENT_LABEL, num, type Movement } from "@/lib/types";
import { money } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MovementTable } from "@/components/movement-list";
import { MovementFilters } from "@/components/movement-filters";
import { isoDaysAgo } from "@/lib/dates";

export const metadata = { title: "Stock history" };

export default async function MovementsPage({ searchParams }: PageProps<"/app/movements">) {
  const sp = await searchParams;
  const ctx = await getContext();
  const cur = ctx.business.currency;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const type = one(sp.type) ?? "all";
  const days = Math.min(3650, Math.max(1, Number(one(sp.days) ?? 30) || 30));
  const qText = (one(sp.q) ?? "").trim().toLowerCase();
  const requested = one(sp.store);
  const storeIds = requested && ctx.stores.some((s) => s.id === requested)
    ? [requested]
    : ctx.activeStore === "all" ? ctx.stores.map((s) => s.id) : [ctx.activeStore];

  const [{ products, suppliers }, people] = await Promise.all([loadCatalog(ctx), loadPeople(ctx)]);
  const productById = new Map(products.map((p) => [p.id, p]));

  let query = ctx.supabase
    .from("movements")
    .select("*")
    .in("store_id", storeIds.length ? storeIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("created_at", isoDaysAgo(days))
    .order("created_at", { ascending: false })
    .limit(500);
  if (type === "transfer") query = query.in("type", ["transfer_in", "transfer_out"]);
  else if (type !== "all") query = query.eq("type", type);
  if (qText) {
    const ids = products.filter((p) => `${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(qText)).map((p) => p.id).slice(0, 100);
    const safe = qText.replace(/[,()%*]/g, " ");
    query = ids.length ? query.or(`product_id.in.(${ids.join(",")}),reference.ilike.*${safe}*`) : query.ilike("reference", `%${safe}%`);
  }
  const { data } = await query;
  const rows = (data ?? []) as Movement[];
  const storeById = new Map(ctx.stores.map((s) => [s.id, s]));

  const sold = rows.filter((m) => m.type === "sale").reduce((s, m) => s + -num(m.quantity) * num(m.unit_price), 0);
  const received = rows.filter((m) => m.type === "receive").reduce((s, m) => s + num(m.quantity) * num(m.unit_cost), 0);

  const csv = {
    head: ["Date", "Type", "Product", "SKU", "Store", "Quantity", "Unit cost", "Unit price", "Reference", "Reason", "Note", "Other store", "By"],
    rows: rows.map((m) => {
      const p = productById.get(m.product_id);
      return [
        m.created_at,
        MOVEMENT_LABEL[m.type],
        p?.name ?? "",
        p?.sku ?? "",
        storeById.get(m.store_id)?.name ?? "",
        num(m.quantity),
        num(m.unit_cost),
        num(m.unit_price),
        m.reference ?? "",
        m.reason ?? "",
        m.note ?? "",
        m.other_store_id ? storeById.get(m.other_store_id)?.name ?? "" : "",
        m.created_by ? people.get(m.created_by) ?? "" : "",
      ];
    }),
  };

  return (
    <>
      <PageHeader
        title="Stock history"
        description={
          <>
            Every item in and out, with who did it. In this view: <span className="font-semibold text-ink">{money(sold, cur)}</span> sold,{" "}
            <span className="font-semibold text-ink">{money(received, cur)}</span> received.
          </>
        }
      />
      <Suspense>
        <MovementFilters stores={ctx.stores} csv={csv} />
      </Suspense>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Nothing here" body="No movements match these filters. Try a longer period or a different type." />
        ) : (
          <>
            <MovementTable
              rows={rows}
              products={productById}
              stores={storeById}
              suppliers={new Map(suppliers.map((s) => [s.id, s]))}
              people={people}
              currency={cur}
            />
            {rows.length === 500 && <p className="border-t border-line px-5 py-3 text-sm text-muted">Showing the latest 500. Narrow the filters or export for more.</p>}
          </>
        )}
      </Card>
    </>
  );
}
