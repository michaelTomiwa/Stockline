import { loadStockPage } from "@/lib/stock-page";
import { PageHeader, ButtonLink, EmptyState } from "@/components/ui";
import { StockForm } from "@/components/stock-form";

export const metadata = { title: "Sell" };

export default async function SellPage() {
  const { ctx, props } = await loadStockPage();
  if (!ctx.stores.length) return <EmptyState title="No stores yet" body="Add a store before recording sales." action={<ButtonLink href="/app/stores">Add a store</ButtonLink>} />;
  return (
    <>
      <PageHeader title="Sell" description="Record a sale. Stock comes off the shelf as soon as you complete it." />
      <StockForm
        mode="sell"
        {...props}
        lockPrices={ctx.isSales}
        seller={ctx.member.full_name || undefined}
        businessName={ctx.business.name}
      />
    </>
  );
}
