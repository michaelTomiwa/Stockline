import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { Card, PageHeader } from "@/components/ui";
import { BusinessForm } from "@/components/settings-form";
import { Onboarding } from "@/components/onboarding";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getContext();
  if (!ctx.isOwner) notFound();
  const { count } = await ctx.supabase.from("products").select("id", { count: "exact", head: true });

  return (
    <>
      <PageHeader title="Settings" description="Your business details." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Business">
          <BusinessForm id={ctx.business.id} name={ctx.business.name} currency={ctx.business.currency} />
        </Card>
        <Card title="Your account">
          <dl className="space-y-3 p-5 text-sm">
            <div>
              <dt className="text-muted">Signed in as</dt>
              <dd className="font-medium">{ctx.user.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Role</dt>
              <dd className="font-medium capitalize">{ctx.member.role}</dd>
            </div>
          </dl>
        </Card>
      </div>
      {count === 0 && (
        <div className="mt-6">
          <Onboarding isOwner hasStores={ctx.stores.length > 0} />
        </div>
      )}
    </>
  );
}
