"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownUp, Search, ShieldPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { cn, compactMoney, fullDate, money, timeAgo } from "@/lib/format";
import { Button, ErrorNote, friendlyError, inputClass } from "./ui-client";
import { td, th } from "./ui";

export type AdminBusiness = {
  id: string;
  name: string;
  currency: string;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  stores: number;
  products: number;
  people: number;
  salespeople: number;
  stock_value: number;
  sales_today: number;
  sales_30d: number;
  orders_30d: number;
  last_activity: string | null;
};

type SortKey = "recent" | "sales" | "active" | "name";

export function AdminBusinessTable({ rows }: { rows: AdminBusiness[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? rows.filter((r) => `${r.name} ${r.owner_name ?? ""} ${r.owner_email ?? ""}`.toLowerCase().includes(s)) : rows;
    const by: Record<SortKey, (a: AdminBusiness, b: AdminBusiness) => number> = {
      recent: (a, b) => b.created_at.localeCompare(a.created_at),
      sales: (a, b) => b.sales_30d - a.sales_30d,
      active: (a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [rows, q, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <label className="relative min-w-56 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business, owner or email" className={cn(inputClass, "bg-panel pl-9")} />
        </label>
        <label className="flex items-center gap-1.5 rounded-xl border border-line bg-panel pl-3 text-sm text-muted">
          <ArrowDownUp size={14} />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 bg-transparent pr-2 outline-none" aria-label="Sort">
            <option value="recent">Newest</option>
            <option value="sales">Most sales</option>
            <option value="active">Recently active</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-sunk">
            <tr>
              <th className={th}>Business</th>
              <th className={th}>Joined</th>
              <th className={cn(th, "text-right")}>Stores</th>
              <th className={cn(th, "text-right")}>Products</th>
              <th className={cn(th, "text-right")}>People</th>
              <th className={cn(th, "text-right")}>Stock value</th>
              <th className={cn(th, "text-right")}>Today</th>
              <th className={cn(th, "text-right")}>30 days</th>
              <th className={th}>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.id} className="border-t border-line transition-colors hover:bg-sunk/60">
                <td className={td}>
                  <Link href={`/admin/businesses/${b.id}`} className="font-semibold hover:text-pine">
                    {b.name}
                  </Link>
                  <span className="block text-xs text-muted">
                    {b.owner_name || "—"}
                    {b.owner_email && <> · {b.owner_email}</>}
                  </span>
                </td>
                <td className={cn(td, "whitespace-nowrap text-muted")}>{fullDate(b.created_at)}</td>
                <td className={cn(td, "text-right tnum")}>{b.stores}</td>
                <td className={cn(td, "text-right tnum")}>{b.products}</td>
                <td className={cn(td, "text-right tnum")}>
                  {b.people}
                  {b.salespeople > 0 && <span className="block text-xs text-faint">{b.salespeople} selling</span>}
                </td>
                <td className={cn(td, "text-right tnum")}>{compactMoney(b.stock_value, b.currency)}</td>
                <td className={cn(td, "text-right tnum")}>{b.sales_today ? money(b.sales_today, b.currency) : <span className="text-faint">—</span>}</td>
                <td className={cn(td, "text-right tnum")}>
                  <span className="font-semibold">{money(b.sales_30d, b.currency)}</span>
                  <span className="block text-xs text-faint">{b.orders_30d} sales</span>
                </td>
                <td className={cn(td, "whitespace-nowrap")}>
                  {b.last_activity ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-full", recent(b.last_activity) ? "bg-ok" : "bg-line")} />
                      {timeAgo(b.last_activity)}
                    </span>
                  ) : (
                    <span className="text-faint">Not started</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-5 py-12 text-center text-muted">{rows.length ? "No business matches that search." : "No businesses have signed up yet."}</p>}
      </div>
    </div>
  );
}

function recent(iso: string) {
  // Used only to colour the dot; a day is close enough.
  return Date.parse(iso) > Date.now() - 864e5;
}

export function AdminList({ admins }: { admins: { email: string; added_at: string; is_you: boolean }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("admin_add", { p_email: email });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setEmail("");
    router.refresh();
  }

  async function remove(target: string) {
    if (!confirm(`Remove ${target} as a Stockline admin?`)) return;
    const { error } = await createClient().rpc("admin_remove", { p_email: target });
    if (error) return setError(friendlyError(error.message));
    router.refresh();
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {admins.map((a) => (
          <li key={a.email} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{a.email}</span>
              <span className="text-xs text-faint">{a.is_you ? "You" : `Added ${fullDate(a.added_at)}`}</span>
            </span>
            {!a.is_you && (
              <button onClick={() => remove(a.email)} className="rounded-lg p-1.5 text-faint hover:bg-out/10 hover:text-out" aria-label={`Remove ${a.email}`}>
                <X size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="space-y-2 border-t border-line p-4">
        <div className="flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="name@example.com" className={inputClass} aria-label="Admin email" />
          <Button busy={busy} className="shrink-0">
            <ShieldPlus size={16} /> Add
          </Button>
        </div>
        <p className="text-xs text-faint">They need a Stockline account with this email (and to have confirmed it) to get in.</p>
        <ErrorNote message={error} />
      </form>
    </div>
  );
}
