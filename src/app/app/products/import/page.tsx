import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getContext, operatingStore } from "@/lib/context";
import { PageHeader } from "@/components/ui";
import { ProductImporter } from "@/components/product-importer";

export const metadata = { title: "Import products" };

export default async function ImportProductsPage() {
  const ctx = await getContext();
  if (!ctx.canManage) notFound();
  const first = operatingStore(ctx);
  // The selected store first, so quantities go there by default.
  const stores = [...ctx.stores].sort((a, b) => Number(b.id === first) - Number(a.id === first));
  return (
    <>
      <Link href="/app/products" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Products
      </Link>
      <PageHeader title="Import products" description="Add or update hundreds of products at once by pasting from Excel or Google Sheets." />
      <ProductImporter stores={stores} currency={ctx.business.currency} doneHref="/app/products" />
    </>
  );
}
