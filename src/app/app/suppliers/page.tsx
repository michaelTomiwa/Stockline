import { Mail, MessageCircle, Phone } from "lucide-react";
import { getStockContext } from "@/lib/context";
import { loadCatalog } from "@/lib/inventory";
import { num } from "@/lib/types";
import { fullDate, money } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { SupplierButton } from "@/components/supplier-form";
import { Stagger, StaggerItem } from "@/components/motion";
import { isoDaysAgo } from "@/lib/dates";

export const metadata = { title: "Suppliers" };

function whatsapp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("0") ? `234${digits.slice(1)}` : digits}`;
}

export default async function SuppliersPage() {
  const ctx = await getStockContext();
  const cur = ctx.business.currency;
  const [{ products, suppliers }, { data: deliveries }] = await Promise.all([
    loadCatalog(ctx),
    ctx.supabase
      .from("movements")
      .select("supplier_id, quantity, unit_cost, created_at")
      .eq("type", "receive")
      .not("supplier_id", "is", null)
      .gte("created_at", isoDaysAgo(90))
      .limit(5000),
  ]);

  const stats = new Map<string, { spent: number; last: string | null }>();
  for (const d of deliveries ?? []) {
    const s = stats.get(d.supplier_id) ?? { spent: 0, last: null };
    s.spent += num(d.quantity) * num(d.unit_cost);
    if (!s.last || d.created_at > s.last) s.last = d.created_at;
    stats.set(d.supplier_id, s);
  }

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Who you buy from, and how much in the last 90 days."
        actions={ctx.canManage && <SupplierButton businessId={ctx.business.id} />}
      />
      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel">
          <EmptyState title="No suppliers yet" body="Add the companies you buy from, then pick them when you receive stock." action={ctx.canManage && <SupplierButton businessId={ctx.business.id} />} />
        </div>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2">
          {suppliers.map((s) => {
            const st = stats.get(s.id);
            const count = products.filter((p) => p.supplier_id === s.id).length;
            return (
              <StaggerItem key={s.id} className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{s.name}</h2>
                    <p className="text-sm text-muted">{s.contact_name ?? "No contact person"}</p>
                  </div>
                  {ctx.canManage && <SupplierButton supplier={s} businessId={ctx.business.id} />}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted">Products</p>
                    <p className="font-semibold tnum">{count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Bought, 90 days</p>
                    <p className="font-semibold tnum">{money(st?.spent ?? 0, cur)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Last delivery</p>
                    <p className="font-semibold">{st?.last ? fullDate(st.last) : "—"}</p>
                  </div>
                </div>
                {s.notes && <p className="mt-3 rounded-xl bg-sunk px-3 py-2 text-sm text-muted">{s.notes}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.phone && (
                    <>
                      <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-sunk">
                        <Phone size={14} /> Call
                      </a>
                      <a href={whatsapp(s.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-sunk">
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    </>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-sunk">
                      <Mail size={14} /> Email
                    </a>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </>
  );
}
