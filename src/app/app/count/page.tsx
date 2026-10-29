import { notFound } from "next/navigation";
import { loadStockPage } from "@/lib/stock-page";
import { PageHeader, EmptyState, ButtonLink } from "@/components/ui";
import { StockForm } from "@/components/stock-form";

export const metadata = { title: "Stock count" };

export default async function CountPage() {
  const { ctx, props } = await loadStockPage();
  if (!ctx.canManage) notFound();
  if (!ctx.stores.length) return <EmptyState title="No stores yet" body="Add a store first." action={<ButtonLink href="/app/stores">Add a store</ButtonLink>} />;
  return (
    <>
      <PageHeader
        title="Stock count"
        description="Type what's actually on the shelf. Any difference is saved as an adjustment with your reason."
      />
      <StockForm mode="count" {...props} />
    </>
  );
}
