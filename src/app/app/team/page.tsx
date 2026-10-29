import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { fullDate } from "@/lib/format";
import { Card, PageHeader, StoreDot } from "@/components/ui";
import { CancelInvite, InviteForm, MemberControls } from "@/components/team-forms";

export const metadata = { title: "Team" };

const roleHelp = {
  owner: "Sees every store and changes everything.",
  manager: "Runs their store(s): products, deliveries, counts and adjustments.",
  staff: "Sells, receives and transfers at their store.",
};

export default async function TeamPage() {
  const ctx = await getContext();
  if (!ctx.isOwner) notFound();
  const [{ data: members }, { data: invites }] = await Promise.all([
    ctx.supabase.from("members").select("*").order("created_at"),
    ctx.supabase.from("invites").select("*").is("accepted_at", null).order("created_at", { ascending: false }),
  ]);
  const storeName = (id: string | null) => (id ? ctx.stores.find((s) => s.id === id) : null);

  return (
    <>
      <PageHeader title="Team" description="Invite managers and staff, and choose which store each person works in." />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title={`People (${(members ?? []).length})`}>
            <ul className="divide-y divide-line">
              {(members ?? []).map((m) => {
                const st = storeName(m.store_id);
                return (
                  <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-night text-sm font-bold text-citrus">
                        {(m.full_name || m.email || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.full_name || m.email}</p>
                        <p className="truncate text-sm text-muted">
                          {m.email} · joined {fullDate(m.created_at)}
                        </p>
                      </div>
                    </div>
                    {m.role === "owner" ? (
                      <span className="rounded-full bg-citrus px-2.5 py-1 text-xs font-semibold text-night">Owner</span>
                    ) : (
                      <MemberControls userId={m.user_id} role={m.role} storeId={m.store_id} stores={ctx.stores} />
                    )}
                    {m.role !== "owner" && st && (
                      <p className="w-full text-xs text-faint">
                        <StoreDot color={st.color} className="mr-1.5 size-2" />
                        Works at {st.name}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          {(invites ?? []).length > 0 && (
            <Card title="Waiting to join">
              <ul className="divide-y divide-line">
                {(invites ?? []).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      <span className="font-medium">{i.email}</span>{" "}
                      <span className="capitalize text-muted">· {i.role}</span>
                      <span className="text-muted"> · {storeName(i.store_id)?.name ?? "All stores"}</span>
                    </span>
                    <CancelInvite id={i.id} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Invite someone">
            <InviteForm businessId={ctx.business.id} stores={ctx.stores} />
          </Card>
          <Card title="What each role can do">
            <dl className="space-y-3 p-5 text-sm">
              {Object.entries(roleHelp).map(([r, h]) => (
                <div key={r}>
                  <dt className="font-semibold capitalize">{r}</dt>
                  <dd className="text-muted">{h}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
