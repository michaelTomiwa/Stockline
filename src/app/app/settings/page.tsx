import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { Card, PageHeader } from "@/components/ui";
import { BusinessForm, EmailAlertsForm } from "@/components/settings-form";
import { emailConfigured } from "@/lib/email";
import { Onboarding } from "@/components/onboarding";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getContext();
  if (!ctx.isOwner) notFound();
  const [{ count }, { data: biz }, { data: ownerEmail }] = await Promise.all([
    ctx.supabase.from("products").select("id", { count: "exact", head: true }),
    ctx.supabase.from("businesses").select("sale_emails, sale_email_min, notify_email").eq("id", ctx.business.id).maybeSingle(),
    ctx.supabase.rpc("owner_email"),
  ]);

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
              <dd className="font-medium">Owner</dd>
            </div>
          </dl>
        </Card>
        <Card title="Email alerts" className="lg:col-span-2">
          <EmailAlertsForm
            id={ctx.business.id}
            enabled={biz?.sale_emails ?? true}
            minAmount={Number(biz?.sale_email_min ?? 0)}
            notifyEmail={biz?.notify_email ?? null}
            ownerEmail={(ownerEmail as string | null) ?? ctx.user.email ?? ""}
            configured={emailConfigured()}
            currency={ctx.business.currency}
          />
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
