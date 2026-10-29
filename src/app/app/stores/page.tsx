import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { getStockContext } from "@/lib/context";
import { loadCatalog, loadLevels, stockGrid, totals } from "@/lib/inventory";
import { num } from "@/lib/types";
import { money } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { HealthBar } from "@/components/charts";
import { StoreButton } from "@/components/store-form";
import { Stagger, StaggerItem } from "@/components/motion";

export const metadata = { title: "Stores" };

export default async function StoresPage() {
  const ctx = await getStockContext();
  const cur = ctx.business.currency;
  const [{ products }, levels, salesRes] = await Promise.all([
    loadCatalog(ctx),
    loadLevels(ctx, ctx.stores.map((s) => s.id)),
    ctx.supabase.rpc("store_sales", { p_days: 30 }),
  ]);
  const sales = new Map(((salesRes.data ?? []) as { store_id: string; revenue: unknown; profit: unknown; orders: unknown }[]).map((r) => [r.store_id, r]));

  return (
    <>
      <PageHeader
        title="Stores"
        description={`${ctx.stores.length} ${ctx.stores.length === 1 ? "store" : "stores"}`}
        actions={ctx.isOwner && <StoreButton businessId={ctx.business.id} />}
      />
      {ctx.stores.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel">
          <EmptyState title="Add your first store" body="Each branch or shop gets its own stock, sales and history." action={ctx.isOwner && <StoreButton businessId={ctx.business.id} />} />
        </div>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ctx.stores.map((s) => {
            const t = totals(stockGrid(products, [s], levels));
            const r = sales.get(s.id);
            return (
              <StaggerItem key={s.id} className="relative">
                {ctx.isOwner && (
                  <div className="absolute right-3 top-4 z-10">
                    <StoreButton store={s} businessId={ctx.business.id} compact />
                  </div>
                )}
                <Link href={`/app/stores/${s.id}`} className="group block overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="h-1.5" style={{ background: s.color }} />
                  <div className="p-5">
                    <h2 className="pr-16 text-lg font-bold group-hover:text-pine">{s.name}</h2>
                    {s.address && (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                        <MapPin size={14} className="mt-0.5 shrink-0" /> {s.address}
                      </p>
                    )}
                    {s.phone && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                        <Phone size={14} /> {s.phone}
                      </p>
                    )}
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted">Stock value</p>
                        <p className="text-lg font-bold tnum">{money(t.cost, cur)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">Sales, 30 days</p>
                        <p className="text-lg font-bold tnum">{money(num(r?.revenue), cur)}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <HealthBar ok={t.ok} low={t.low} out={t.out} />
                      <p className="mt-2 text-xs text-muted tnum">
                        {t.ok} healthy · <span className="text-low">{t.low} low</span> · <span className="text-out">{t.out} out</span>
                      </p>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </>
  );
}
