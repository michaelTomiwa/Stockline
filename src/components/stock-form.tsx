"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CircleCheck, MessageCircle, Minus, Plus, Printer, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { notifySale } from "@/app/app/actions";
import type { Category, Product, Store, Supplier } from "@/lib/types";
import { stockStatus } from "@/lib/types";
import { cn, dateTime, money, qty } from "@/lib/format";
import { Button, ErrorNote, SelectField, friendlyError, inputClass } from "./ui-client";
import { StoreDot } from "./ui";
import { ScanButton } from "./scan-button";

export type Mode = "sell" | "receive" | "transfer" | "count";

type Line = { product: Product; quantity: number; price: number };

const copy: Record<Mode, { cta: string; done: string; empty: string; qtyLabel: string }> = {
  sell: { cta: "Complete sale", done: "Sale recorded", empty: "Tap products to add them to this sale.", qtyLabel: "Qty" },
  receive: { cta: "Receive stock", done: "Stock received", empty: "Add the products in this delivery.", qtyLabel: "Qty" },
  transfer: { cta: "Send stock", done: "Transfer recorded", empty: "Add the products you're sending.", qtyLabel: "Send" },
  count: { cta: "Save count", done: "Count saved", empty: "Add products and type what's actually on the shelf.", qtyLabel: "Counted" },
};

export function StockForm({
  mode,
  products,
  categories,
  stores,
  toStores,
  suppliers,
  levels,
  defaultStore,
  currency,
  lockPrices = false,
  seller,
  businessName,
}: {
  mode: Mode;
  products: Product[];
  categories: Category[];
  stores: Store[];
  toStores?: Store[]; // transfer destinations; defaults to `stores`

  suppliers: Supplier[];
  levels: Record<string, number>; // `${store}:${product}` → quantity
  defaultStore: string;
  currency: string;
  lockPrices?: boolean; // salespeople sell at the listed price
  seller?: string; // shown on receipts
  businessName?: string;
}) {
  const router = useRouter();
  const [store, setStore] = useState(defaultStore);
  const destinations = toStores ?? stores;
  const [toStore, setToStore] = useState(destinations.find((s) => s.id !== defaultStore)?.id ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("Stock count");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ lines: Line[]; total: number; at: string; storeName: string; reference: string } | null>(null);
  const search = useRef<HTMLInputElement>(null);

  const have = useCallback((productId: string, storeId = store) => levels[`${storeId}:${productId}`] ?? 0, [levels, store]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products
      .filter((p) => (cat === "all" || p.category_id === cat) && (!s || `${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(s)))
      .slice(0, 60);
  }, [products, q, cat]);

  const add = useCallback(
    (p: Product) => {
      setError(null);
      setLines((ls) => {
        const i = ls.findIndex((l) => l.product.id === p.id);
        if (i >= 0) {
          if (mode === "count") return ls;
          const copy = [...ls];
          copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
          return copy;
        }
        const start = mode === "count" ? Math.max(0, have(p.id)) : 1;
        return [{ product: p, quantity: start, price: mode === "receive" ? p.cost_price : p.sell_price }, ...ls];
      });
    },
    [mode, have],
  );

  const onCode = useCallback(
    (code: string) => {
      const p = products.find((x) => x.barcode === code || x.sku.toLowerCase() === code.toLowerCase());
      if (p) add(p);
      else setError(`No product with barcode or SKU ${code}.`);
    },
    [products, add],
  );

  function setLine(id: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, ...patch } : l)));
  }

  const total = lines.reduce((s, l) => s + l.quantity * (mode === "transfer" || mode === "count" ? l.product.cost_price : l.price), 0);
  const short = mode === "sell" || mode === "transfer" ? lines.filter((l) => l.quantity > have(l.product.id)) : [];

  async function submit() {
    setError(null);
    if (lines.length === 0) return setError("Add at least one product.");
    if (short.length) return setError(`Not enough ${short[0].product.name} at this store (only ${qty(have(short[0].product.id))}).`);
    if (mode === "transfer" && !toStore) return setError("Pick the store you're sending to.");
    setBusy(true);
    const supabase = createClient();
    const items = lines.map((l) =>
      mode === "count"
        ? { product_id: l.product.id, counted: l.quantity }
        : mode === "receive"
          ? { product_id: l.product.id, quantity: l.quantity, unit_cost: l.price }
          : mode === "sell"
            ? { product_id: l.product.id, quantity: l.quantity, unit_price: l.price }
            : { product_id: l.product.id, quantity: l.quantity },
    );
    const { data, error } =
      mode === "transfer"
        ? await supabase.rpc("transfer_stock", { p_from: store, p_to: toStore, p_items: items, p_note: note })
        : mode === "count"
          ? await supabase.rpc("count_stock", { p_store: store, p_items: items, p_reason: reason, p_note: note })
          : await supabase.rpc("post_stock", {
              p_store: store,
              p_type: mode === "sell" ? "sale" : "receive",
              p_items: items,
              p_reference: reference,
              p_note: note,
              p_supplier: supplier || null,
            });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    // Email the owner about the sale if they've asked for that; never holds up the till.
    if (mode === "sell" && typeof data === "string") notifySale(data).catch(() => {});
    setDone({ lines, total, at: new Date().toISOString(), storeName: stores.find((x) => x.id === store)?.name ?? "", reference });
    setLines([]);
    setReference("");
    setNote("");
    router.refresh();
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="mx-auto max-w-md rounded-2xl border border-line bg-panel p-8 text-center"
      >
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.1 }} className="inline-block">
          <CircleCheck size={52} className="text-ok" />
        </motion.span>
        <h2 className="mt-4 text-2xl font-bold">{copy[mode].done}</h2>
        <p className="mt-1 text-muted">
          {done.lines.length} {done.lines.length === 1 ? "product" : "products"}
          {mode !== "count" && <> · {money(done.total, currency)}</>}
        </p>
        {mode === "sell" && <Receipt done={done} currency={currency} seller={seller} businessName={businessName} />}
        <div className="no-print mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => { setDone(null); setTimeout(() => search.current?.focus(), 0); }}>
            {mode === "sell" ? "New sale" : "Start another"}
          </Button>
          <Link href="/app/movements" className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-sunk">
            View history
          </Link>
        </div>
      </motion.div>
    );
  }

  const currentStore = stores.find((s) => s.id === store);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      {/* Picker */}
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <SelectField label={mode === "transfer" ? "From" : "Store"} value={store} onChange={(e) => {
              const next = e.target.value;
              setStore(next);
              setLines([]);
              if (next === toStore) setToStore(destinations.find((s) => s.id !== next)?.id ?? "");
            }} className="min-w-44 flex-1 sm:flex-none">
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          {mode === "transfer" && (
            <>
              <ArrowRight size={18} className="mb-3 text-faint" />
              <SelectField label="To" value={toStore} onChange={(e) => setToStore(e.target.value)} className="min-w-44 flex-1 sm:flex-none">
                {destinations.filter((s) => s.id !== store).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectField>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              ref={search}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const exact = products.find((p) => p.barcode === q.trim() || p.sku.toLowerCase() === q.trim().toLowerCase());
                const pick = exact ?? (results.length === 1 ? results[0] : null);
                if (pick) {
                  add(pick);
                  setQ("");
                }
              }}
              placeholder="Search, or scan a barcode and press Enter"
              className={cn(inputClass, "bg-panel pl-9")}
            />
          </label>
          <ScanButton onCode={onCode} />
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-sm",
                cat === c.id ? "border-night bg-night text-white" : "border-line bg-panel text-muted hover:text-ink",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {results.map((p) => {
            const h = have(p.id);
            const st = stockStatus(h, p.reorder_level);
            const inCart = lines.find((l) => l.product.id === p.id);
            const blocked = (mode === "sell" || mode === "transfer") && h <= 0;
            return (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => !blocked && add(p)}
                disabled={blocked}
                className={cn(
                  "relative rounded-xl border bg-panel p-3 text-left transition-colors",
                  inCart ? "border-pine ring-1 ring-pine" : "border-line hover:border-pine/40",
                  blocked && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</span>
                <span className="mt-2 flex items-center justify-between text-xs">
                  <span className={cn("tnum", st === "out" ? "text-out" : st === "low" ? "text-low" : "text-faint")}>
                    {qty(h)} {p.unit}
                  </span>
                  <span className="font-semibold tnum">{money(mode === "receive" ? p.cost_price : p.sell_price, currency)}</span>
                </span>
                {inCart && (
                  <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-pine text-[11px] font-bold text-white">
                    {mode === "count" ? "✓" : inCart.quantity}
                  </span>
                )}
              </motion.button>
            );
          })}
          {results.length === 0 && <p className="col-span-full py-8 text-center text-muted">No products match “{q}”.</p>}
        </div>
      </div>

      {/* Lines */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-semibold">
              {mode === "sell" ? "This sale" : mode === "receive" ? "This delivery" : mode === "transfer" ? "Sending" : "Counted"}
            </h2>
            {currentStore && (
              <span className="flex items-center gap-2 text-sm text-muted">
                <StoreDot color={currentStore.color} /> {currentStore.name}
              </span>
            )}
          </div>
          {lines.length === 0 ? (
            <p className="px-5 py-12 text-center text-muted">{copy[mode].empty}</p>
          ) : (
            <ul className="max-h-[46vh] divide-y divide-line overflow-y-auto">
              <AnimatePresence initial={false}>
                {lines.map((l) => {
                  const h = have(l.product.id);
                  const over = (mode === "sell" || mode === "transfer") && l.quantity > h;
                  const diff = l.quantity - h;
                  return (
                    <motion.li
                      key={l.product.id}
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      className="px-5 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{l.product.name}</p>
                          <p className={cn("text-xs tnum", over ? "text-out" : "text-faint")}>
                            {qty(h)} on hand{over && " — not enough"}
                            {mode === "count" && diff !== 0 && (
                              <span className={diff > 0 ? "text-ok" : "text-out"}> · {diff > 0 ? "+" : ""}{qty(diff)}</span>
                            )}
                          </p>
                        </div>
                        <button onClick={() => setLines((ls) => ls.filter((x) => x.product.id !== l.product.id))} aria-label={`Remove ${l.product.name}`} className="p-1 text-faint hover:text-out">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center rounded-xl border border-line">
                          <button onClick={() => setLine(l.product.id, { quantity: Math.max(0, l.quantity - 1) })} className="p-2 text-muted hover:text-ink" aria-label="Less">
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={l.quantity}
                            onChange={(e) => setLine(l.product.id, { quantity: Math.max(0, Number(e.target.value)) })}
                            aria-label={copy[mode].qtyLabel}
                            className="w-14 bg-transparent text-center font-semibold tnum outline-none"
                          />
                          <button onClick={() => setLine(l.product.id, { quantity: l.quantity + 1 })} className="p-2 text-muted hover:text-ink" aria-label="More">
                            <Plus size={14} />
                          </button>
                        </div>
                        {mode === "sell" && lockPrices && (
                          <span className="text-xs text-muted tnum">@ {money(l.price, currency)}</span>
                        )}
                        {((mode === "sell" && !lockPrices) || mode === "receive") && (
                          <label className="flex items-center gap-1 text-xs text-muted">
                            @
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={l.price}
                              onChange={(e) => setLine(l.product.id, { price: Number(e.target.value) })}
                              aria-label={mode === "sell" ? "Unit price" : "Unit cost"}
                              className="h-9 w-24 rounded-lg border border-line bg-sunk px-2 text-sm tnum outline-none focus:border-pine"
                            />
                          </label>
                        )}
                        {mode !== "count" && (
                          <span className="ml-auto font-semibold tnum">
                            {money(l.quantity * (mode === "transfer" ? l.product.cost_price : l.price), currency)}
                          </span>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}

          <div className="space-y-3 border-t border-line px-5 py-4">
            {mode === "receive" && (
              <div className="grid grid-cols-2 gap-2">
                <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputClass} aria-label="Supplier">
                  <option value="">Supplier (optional)</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice no." className={inputClass} />
              </div>
            )}
            {mode === "sell" && (
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt or payment ref (optional)" className={inputClass} />
            )}
            {mode === "count" && (
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} aria-label="Reason">
                {["Stock count", "Damaged", "Expired", "Lost or stolen", "Found", "Correction"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            )}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={inputClass} />
            {mode !== "count" && (
              <div className="flex items-baseline justify-between">
                <span className="text-muted">{mode === "transfer" ? "Value at cost" : "Total"}</span>
                <span className="text-2xl font-bold tnum">{money(total, currency)}</span>
              </div>
            )}
            <ErrorNote message={error} />
            <Button onClick={submit} busy={busy} disabled={lines.length === 0} className="h-12 w-full text-base">
              {copy[mode].cta}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* What the customer gets: printable, or sent straight to their WhatsApp. */
function Receipt({
  done,
  currency,
  seller,
  businessName,
}: {
  done: { lines: Line[]; total: number; at: string; storeName: string; reference: string };
  currency: string;
  seller?: string;
  businessName?: string;
}) {
  const [phone, setPhone] = useState("");
  const text = [
    `*${businessName ?? "Receipt"}*${done.storeName ? ` · ${done.storeName}` : ""}`,
    dateTime(done.at),
    "",
    ...done.lines.map((l) => `${qty(l.quantity)} × ${l.product.name}  ${money(l.quantity * l.price, currency)}`),
    "",
    `*Total: ${money(done.total, currency)}*`,
    ...(done.reference ? [`Ref: ${done.reference}`] : []),
    ...(seller ? [`Served by ${seller}`] : []),
    "Thank you for shopping with us!",
  ].join("\n");
  // wa.me wants the number in international form without "+" (0803… → 234803…).
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  const wa = `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;

  return (
    <div className="mt-6 text-left">
      <div className="rounded-xl border border-dashed border-line bg-sunk/60 p-4 font-mono text-[13px] leading-relaxed">
        <p className="font-semibold">{businessName}{done.storeName && ` · ${done.storeName}`}</p>
        <p className="text-faint">{dateTime(done.at)}</p>
        <ul className="my-3 space-y-0.5">
          {done.lines.map((l) => (
            <li key={l.product.id} className="flex justify-between gap-3">
              <span className="truncate">{qty(l.quantity)} × {l.product.name}</span>
              <span className="tnum">{money(l.quantity * l.price, currency)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-line pt-2 font-semibold">
          <span>Total</span>
          <span className="tnum">{money(done.total, currency)}</span>
        </p>
        {seller && <p className="mt-2 text-faint">Served by {seller}</p>}
      </div>
      <div className="no-print mt-3 flex gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="Customer's number"
          className={cn(inputClass, "flex-1")}
          aria-label="Customer's WhatsApp number"
        />
        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white hover:brightness-95">
          <MessageCircle size={16} /> Send
        </a>
        <button onClick={() => window.print()} className="inline-flex h-10 shrink-0 items-center rounded-xl border border-line px-3 hover:bg-sunk" aria-label="Print receipt">
          <Printer size={16} />
        </button>
      </div>
    </div>
  );
}
