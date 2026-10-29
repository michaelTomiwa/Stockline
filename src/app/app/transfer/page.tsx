import { notFound } from "next/navigation";
import { loadStockPage } from "@/lib/stock-page";
import { PageHeader, EmptyState, ButtonLink } from "@/components/ui";
import { StockForm } from "@/components/stock-form";

export const metadata = { title: "Transfer" };

export default async function TransferPage() {
  const { ctx, props } = await loadStockPage();
  if (ctx.isSales) notFound();
  const { data: all } = await ctx.supabase.from("stores").select("*").eq("archived", false).order("created_at");
  if ((all ?? []).length < 2) {
    return <EmptyState title="You need two stores to transfer" body="Add another store, then move stock between them here." action={<ButtonLink href="/app/stores">Add a store</ButtonLink>} />;
  }
  // Send from a store you work in, to any store in the business.
  return (
    <>
      <PageHeader title="Transfer" description="Move stock between stores. Both stores update at once." />
      <StockForm mode="transfer" {...props} toStores={all ?? []} />
    </>
  );
}
