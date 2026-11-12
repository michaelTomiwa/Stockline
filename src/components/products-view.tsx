"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Check, Download, Pencil, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Category, Product, StockStatus, Store, Supplier } from "@/lib/types";
import { stockStatus } from "@/lib/types";
import { cn, money, qty } from "@/lib/format";
import { StatusBadge, StoreDot, td, th } from "./ui";
import { Button, Drawer, friendlyError, inputClass } from "./ui-client";
import { ProductForm } from "./product-form";
import { downloadCsv } from "@/lib/csv";

export type ProductRow = Product & { perStore: Record<string, number>; total: number; status: StockStatus };

type SortKey = "name" | "stock" | "value" | "price";

export function ProductsView({
  rows,
  stores,
  categories,
  suppliers,
  businessId,
  currency,
  canManage,
  showCost = true,
}: {
  rows: ProductRow[];
  stores: Store[];
  categories: Category[];
  suppliers: Supplier[];
  businessId: string;
  currency: string;
  canManage: boolean;
  showCost?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<StockStatus | "all">((params.get("status") as StockStatus) ?? "all");
  const [sort, setSort] = useState<SortKey>("name");
  // Narrow to products that have been stocked at one store (hides other stores' items).
  const [where, setWhere] = useState("all");
  const [editing, setEditing] = useState<Product | "new" | null>(params.get("new") ? "new" : null);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (!s || `${r.name} ${r.sku} ${r.barcode ?? ""}`.toLowerCase().includes(s)) &&
        (cat === "all" || r.category_id === cat) &&
        (where === "all" || where in r.perStore) &&
        (status === "all" || (status === "low" ? r.status === "low" || r.status === "out" : r.status === status)),
    );
    const by: Record<SortKey, (a: ProductRow, b: ProductRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      stock: (a, b) => a.total - b.total,
      value: (a, b) => b.total * b.cost_price - a.total * a.cost_price,
      price: (a, b) => b.sell_price - a.sell_price,
    };
    return list.sort(by[sort]);
  }, [rows, q, cat, status, sort, where]);

  const counts = {
    all: rows.length,
    low: rows.filter((r) => r.status === "low" || r.status === "out").length,
    out: rows.filter((r) => r.status === "out").length,
  };

  function exportCsv() {
    downloadCsv(
      "products.csv",
      ["Name", "SKU", "Barcode", "Category", "Unit", ...(showCost ? ["Cost"] : []), "Price", "Reorder at", ...stores.map((s) => s.name), "Total"],
      shown.map((r) => [
        r.name,
        r.sku,
        r.barcode ?? "",
        catName.get(r.category_id ?? "") ?? "",
        r.unit,
        ...(showCost ? [r.cost_price] : []),
        r.sell_price,
        r.reorder_level,
        ...stores.map((s) => r.perStore[s.id] ?? 0),
        r.total,
      ]),
    );
  }

  function closeDrawer() {
    setEditing(null);
    if (params.get("new")) router.replace("/app/products");
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-60 flex-1 basis-full sm:basis-auto">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, SKU or barcode"
            className={cn(inputClass, "bg-panel pl-9")}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-line bg-panel p-1 text-sm">
            {(
              [
                ["all", `All ${counts.all}`],
                ["low", `Low ${counts.low}`],
                ["out", `Out ${counts.out}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setStatus(k)}
                className={cn("rounded-lg px-3 py-1.5 font-medium", status === k ? "bg-night text-white" : "text-muted hover:text-ink")}
              >
                {label}
              </button>
            ))}
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={cn(inputClass.replace("w-full", "w-44"), "bg-panel")} aria-label="Category">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {stores.length > 1 && (
            <select value={where} onChange={(e) => setWhere(e.target.value)} className={cn(inputClass.replace("w-full", "w-48"), "bg-panel")} aria-label="Store">
              <option value="all">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  Only {s.name}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1.5 rounded-xl border border-line bg-panel pl-3 text-sm text-muted">
            <ArrowDownUp size={14} />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 bg-transparent pr-2 outline-none" aria-label="Sort">
              <option value="name">Name</option>
              <option value="stock">Lowest stock</option>
              <option value="value">Stock value</option>
              <option value="price">Price</option>
            </select>
          </label>
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={16} /> CSV
          </Button>
          {canManage && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> Add product
            </Button>
          )}
        </div>
      </div>

      {canManage && shown.length > 0 && (
        <p className="mb-2 flex items-center gap-1.5 text-sm text-muted">
          <Pencil size={13} className="text-pine" /> Tap any price to change it.
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        {/* Phones: one card per product, price right there to tap. */}
        <ul className="divide-y divide-line sm:hidden">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/app/products/${r.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <span className={cn("font-semibold tnum", r.status === "out" ? "text-out" : r.status === "low" ? "text-low" : "text-ink")}>
                    {qty(r.total)} {r.unit}
                  </span>
                  <span className="truncate font-mono text-faint">{r.sku}</span>
                </span>
              </Link>
              <span className="shrink-0 text-right text-sm">
                {canManage ? <PriceCell id={r.id} price={r.sell_price} currency={currency} /> : <span className="font-semibold tnum">{money(r.sell_price, currency)}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-sunk">
              <tr>
                <th className={th}>Product</th>
                <th className={th}>Category</th>
                {stores.length > 1 &&
                  stores.map((s) => (
                    <th key={s.id} className={cn(th, "text-right")}>
                      <span className="inline-flex items-center gap-1.5">
                        <StoreDot color={s.color} className="size-2" />
                        {s.name}
                      </span>
                    </th>
                  ))}
                <th className={cn(th, "text-right")}>{stores.length > 1 ? "Total" : "In stock"}</th>
                <th className={cn(th, "text-right")}>Price</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-line transition-colors hover:bg-sunk/60">
                  <td className={td}>
                    <Link href={`/app/products/${r.id}`} className="font-medium hover:text-pine">
                      {r.name}
                    </Link>
                    <span className="block font-mono text-xs text-faint">{r.sku}</span>
                  </td>
                  <td className={cn(td, "text-muted")}>{catName.get(r.category_id ?? "") ?? "—"}</td>
                  {stores.length > 1 &&
                    stores.map((s) => {
                      const v = r.perStore[s.id] ?? 0;
                      const st = stockStatus(v, r.reorder_level);
                      return (
                        <td key={s.id} className={cn(td, "text-right tnum", st === "out" && "text-out", st === "low" && "text-low")}>
                          {qty(v)}
                        </td>
                      );
                    })}
                  <td className={cn(td, "text-right font-semibold tnum")}>
                    {qty(r.total)} <span className="font-normal text-faint">{r.unit}</span>
                  </td>
                  <td className={cn(td, "text-right tnum")}>
                    {canManage ? <PriceCell id={r.id} price={r.sell_price} currency={currency} /> : money(r.sell_price, currency)}
                  </td>
                  <td className={td}>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && (
          <p className="px-5 py-12 text-center text-muted">
            {rows.length === 0 ? "No products yet. Add your first one." : "Nothing matches. Clear the search or filters."}
          </p>
        )}
      </div>

      <Drawer open={editing !== null} onClose={closeDrawer} title={editing === "new" ? "Add a product" : "Edit product"}>
        {editing !== null && (
          <ProductForm
            key={editing === "new" ? "new" : editing.id}
            product={editing === "new" ? undefined : editing}
            categories={categories}
            suppliers={suppliers}
            businessId={businessId}
            onDone={closeDrawer}
          />
        )}
      </Drawer>
    </>
  );
}

/*
  Tap a price to change it. Works on phones: a pencil is always shown, the input opens the
  number keypad, and there's a Save button (Enter also saves, Escape cancels).
  The update asks for the row back, so a save that changed nothing is reported, not hidden.
*/
export function PriceCell({ id, price, currency, big = false }: { id: string; price: number; currency: string; big?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(price));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const shown = saved ?? price;

  async function save() {
    const next = Number(value.replace(/[,\s₦]/g, ""));
    if (value.trim() === "" || !Number.isFinite(next) || next < 0) return setError("Type a number, e.g. 9000");
    if (next === shown) return setEditing(false);
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().from("products").update({ sell_price: next }).eq("id", id).select("id");
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    if (!data || data.length === 0) return setError("Couldn't save. Your account can't change this price.");
    setSaved(next);
    setEditing(false);
    router.refresh();
    setTimeout(() => setSaved(null), 4000);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(shown));
          setError(null);
          setEditing(true);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2 py-1 font-semibold tnum transition hover:border-pine hover:bg-pine/5",
          big && "px-3 py-1.5 text-lg",
          saved !== null && "border-solid border-ok bg-ok/10 text-ok",
        )}
        title="Change price"
      >
        {saved !== null ? <Check size={big ? 16 : 13} /> : <Pencil size={big ? 15 : 12} className="text-pine" />}
        {money(shown, currency)}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          value={value}
          disabled={busy}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label="New price"
          className={cn("h-10 w-28 rounded-lg border bg-panel px-2 text-right text-base tnum outline-none", error ? "border-out" : "border-pine")}
        />
        <button type="button" onClick={save} disabled={busy} className="grid h-10 min-w-10 place-items-center rounded-lg bg-pine px-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-sunk">
          <X size={16} />
        </button>
      </span>
      {error && <span className="max-w-56 text-right text-xs text-out">{error}</span>}
    </span>
  );
}
