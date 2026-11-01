import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/format";
import { num, type Store } from "@/lib/types";
import { Card } from "@/components/ui";
import { AdminProductTable, type AdminProduct } from "@/components/admin";
import { ProductImporter } from "@/components/product-importer";

export const metadata = { title: "Products" };

/* An admin helping a business: see its catalogue and stock, fix names and prices, or import products for it. */
export default async function AdminBusinessProducts({ params, searchParams }: PageProps<"/admin/businesses/[id]/products">) {
  const { id } = await params;
  const tab = (await searchParams).tab === "import" ? "import" : "products";
  const supabase = await createClient();
  const [bizRes, prodRes] = await Promise.all([supabase.rpc("admin_business", { p_id: id }), supabase.rpc("admin_products", { p_business: id })]);
  if (bizRes.error || !bizRes.data) notFound();
  const detail = bizRes.data as { business: { name: string; currency: string }; stores: (Store & { archived: boolean })[] };
  const stores = detail.stores.filter((s) => !s.archived);
  const rows: AdminProduct[] = ((prodRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    sku: String(r.sku),
    category: (r.category as string) ?? null,
    unit: String(r.unit),
    cost_price: num(r.cost_price),
    sell_price: num(r.sell_price),
    archived: Boolean(r.archived),
    stock: (r.stock as Record<string, number>) ?? {},
    total: num(r.total),
  }));

  return (
    <>
      <Link href={`/admin/businesses/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> {detail.business.name}
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{detail.business.name}: products</h1>
          <p className="mt-1 text-muted">
            {rows.filter((r) => !r.archived).length} products across {stores.length} {stores.length === 1 ? "store" : "stores"}. Changes you make here show for the owner
            straight away.
          </p>
        </div>
        <div className="flex rounded-xl border border-line bg-panel p-1 text-sm">
          {[
            ["products", "Products & prices"],
            ["import", "Import"],
          ].map(([k, label]) => (
            <Link
              key={k}
              href={`/admin/businesses/${id}/products${k === "import" ? "?tab=import" : ""}`}
              className={cn("rounded-lg px-3 py-1.5 font-medium", tab === k ? "bg-night text-white" : "text-muted hover:text-ink")}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      {tab === "import" ? (
        <ProductImporter stores={stores} currency={detail.business.currency} businessId={id} doneHref={`/admin/businesses/${id}/products`} />
      ) : (
        <Card>
          <AdminProductTable rows={rows} stores={stores} currency={detail.business.currency} />
        </Card>
      )}
    </>
  );
}
