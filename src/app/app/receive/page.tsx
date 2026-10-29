import { loadStockPage } from "@/lib/stock-page";
import { PageHeader, ButtonLink, EmptyState } from "@/components/ui";
import { StockForm } from "@/components/stock-form";

export const metadata = { title: "Receive stock" };

export default async function ReceivePage() {
  const { ctx, props } = await loadStockPage();
  if (!ctx.stores.length) return <EmptyState title="No stores yet" body="Add a store before receiving stock." action={<ButtonLink href="/app/stores">Add a store</ButtonLink>} />;
  return (
    <>
      <PageHeader title="Receive stock" description="Log a delivery from a supplier. A new cost price updates the product." />
      <StockForm mode="receive" {...props} />
    </>
  );
}
