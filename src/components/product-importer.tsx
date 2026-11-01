"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CircleCheck, Download, FileUp, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { FIELD_LABEL, parseImport, TEMPLATE_CSV, type ImportRow } from "@/lib/import-parse";
import { cn, money } from "@/lib/format";
import type { Store } from "@/lib/types";
import { Button, ErrorNote, SelectField, friendlyError, inputClass } from "./ui-client";
import { td, th } from "./ui";

type Result = { created: number; updated: number; stocked: number; errors: { row: number; error: string }[] };

const CHUNK = 400;

/*
  Paste rows from Excel / Google Sheets (or upload a CSV) and import them in one go.
  Owners/managers import into their business; a Stockline admin passes businessId.
*/
export function ProductImporter({ stores, currency, businessId, doneHref }: { stores: Store[]; currency: string; businessId?: string; doneHref: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [store, setStore] = useState(stores[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const parsed = useMemo(() => parseImport(text), [text]);
  const withStock = parsed.rows.filter((r) => (r.qty ?? 0) > 0).length;

  async function readFile(file: File) {
    setText(await file.text());
    setResult(null);
  }

  async function run() {
    setBusy(true);
    setError(null);
    setProgress(0);
    const supabase = createClient();
    const total: Result = { created: 0, updated: 0, stocked: 0, errors: [] };
    for (let i = 0; i < parsed.rows.length; i += CHUNK) {
      const chunk = parsed.rows.slice(i, i + CHUNK);
      const { data, error } = businessId
        ? await supabase.rpc("admin_import_products", { p_business: businessId, p_rows: chunk, p_store: store || null })
        : await supabase.rpc("import_products", { p_rows: chunk, p_store: store || null });
      if (error) {
        setBusy(false);
        return setError(friendlyError(error.message));
      }
      const r = data as Result;
      total.created += r.created;
      total.updated += r.updated;
      total.stocked += r.stocked;
      total.errors.push(...r.errors.map((e) => ({ ...e, row: e.row + i })));
      setProgress(Math.min(parsed.rows.length, i + CHUNK));
    }
    setBusy(false);
    setResult(total);
    router.refresh();
  }

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-lg rounded-2xl border border-line bg-panel p-8 text-center">
        <CircleCheck size={48} className="mx-auto text-ok" />
        <h2 className="mt-3 text-2xl font-bold">Import done</h2>
        <p className="mt-2 text-muted">
          <span className="font-semibold text-ink">{result.created}</span> new products,{" "}
          <span className="font-semibold text-ink">{result.updated}</span> updated
          {result.stocked > 0 && (
            <>
              , stock added for <span className="font-semibold text-ink">{result.stocked}</span>
            </>
          )}
          .
        </p>
        {result.errors.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto rounded-xl bg-out/8 p-3 text-left text-sm text-out">
            <p className="font-semibold">{result.errors.length} rows skipped:</p>
            {result.errors.slice(0, 30).map((e) => (
              <p key={e.row}>
                Row {e.row}: {e.error}
              </p>
            ))}
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setText("");
              setResult(null);
            }}
          >
            Import more
          </Button>
          <Button onClick={() => router.push(doneHref)}>See products</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px] [&>*]:min-w-0">
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-panel p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">1. Paste your products</p>
            <div className="flex gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-sunk">
                <FileUp size={15} /> Upload CSV
                <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
              </label>
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`}
                download="stockline-products-template.csv"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-sunk"
              >
                <Download size={15} /> Template
              </a>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            spellCheck={false}
            placeholder={"Copy the rows from Excel or Google Sheets (with the header row) and paste here.\n\nName\tCategory\tSize\tColour\tCost\tPrice\tQty\nMen's loafers\tMen's shoes\t42\tBrown\t18000\t28000\t4"}
            className={cn(inputClass, "h-56 resize-y py-3 font-mono text-[13px] leading-relaxed")}
          />
          <p className="mt-2 text-xs text-faint">
            Columns it understands: Name, Category, Size, Colour, Cost, Price, Qty, SKU, Unit, Reorder at, Barcode. Only Name is required. A product with the same
            SKU (or the same name, if there&rsquo;s no SKU) is updated instead of added twice, so you can also use this to change many prices at once.
          </p>
        </div>

        {parsed.rows.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-line bg-panel">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <p className="font-semibold">2. Check the preview</p>
              <p className="text-sm text-muted">
                {parsed.rows.length} products{withStock > 0 && <> · {withStock} with stock</>}
                {!parsed.hasHeader && " · no header row, read as Name, Category, Size, Colour, Cost, Price, Qty"}
              </p>
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 bg-sunk">
                  <tr>
                    <th className={th}>#</th>
                    {(["name", "category", "size", "color", "cost", "price", "qty", "sku"] as const).map((f) => (
                      <th key={f} className={cn(th, ["cost", "price", "qty"].includes(f) && "text-right")}>
                        {FIELD_LABEL[f]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 200).map((r: ImportRow, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className={cn(td, "text-faint tnum")}>{i + 1}</td>
                      <td className={cn(td, "font-medium")}>{r.name}</td>
                      <td className={cn(td, "text-muted")}>{r.category ?? "—"}</td>
                      <td className={td}>{r.size ?? ""}</td>
                      <td className={td}>{r.color ?? ""}</td>
                      <td className={cn(td, "text-right tnum text-muted")}>{r.cost !== undefined ? money(r.cost, currency) : "—"}</td>
                      <td className={cn(td, "text-right font-semibold tnum")}>{r.price !== undefined ? money(r.price, currency) : "—"}</td>
                      <td className={cn(td, "text-right tnum")}>{r.qty ?? ""}</td>
                      <td className={cn(td, "font-mono text-xs text-faint")}>{r.sku ?? "auto"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 200 && <p className="border-t border-line px-5 py-2 text-xs text-faint">Showing the first 200 of {parsed.rows.length}.</p>}
            </div>
          </div>
        )}
        {parsed.problems.length > 0 && (
          <div className="rounded-xl bg-low/10 p-3 text-sm text-low">
            {parsed.problems.slice(0, 8).map((p) => (
              <p key={p}>{p}</p>
            ))}
            {parsed.problems.length > 8 && <p>…and {parsed.problems.length - 8} more.</p>}
          </div>
        )}
      </div>

      <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="space-y-4 rounded-2xl border border-line bg-panel p-5">
          <p className="font-semibold">3. Import</p>
          <SelectField label="Put the quantities into" value={store} onChange={(e) => setStore(e.target.value)}>
            <option value="">No store (products only, no stock)</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <p className="text-xs text-faint">Quantities are recorded as one &ldquo;Imported stock&rdquo; delivery, so they show in stock history.</p>
          {busy && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-sunk">
                <div className="h-full rounded-full bg-pine transition-all" style={{ width: `${(progress / Math.max(1, parsed.rows.length)) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted tnum">
                {progress} of {parsed.rows.length}
              </p>
            </div>
          )}
          <ErrorNote message={error} />
          <Button onClick={run} busy={busy} disabled={parsed.rows.length === 0 || !parsed.columns.includes("name")} className="h-12 w-full text-base">
            <Upload size={17} /> Import {parsed.rows.length || ""} products
          </Button>
        </div>
        <div className="rounded-2xl border border-line bg-sunk/60 p-5 text-sm text-muted">
          <p className="font-semibold text-ink">Adding 400 products in a day</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Download the template, or use your own sheet with the same column names.</li>
            <li>Fill one row per product. For sizes, one row per size (same name).</li>
            <li>Copy all rows in Excel / Google Sheets and paste above.</li>
            <li>Check the preview, pick the store, press Import.</li>
          </ol>
          <p className="mt-2">Any number of rows at once; it sends them in batches of {CHUNK}.</p>
        </div>
      </div>
    </div>
  );
}
