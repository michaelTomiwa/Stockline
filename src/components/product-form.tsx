"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { Category, Product, Supplier } from "@/lib/types";
import { Button, ErrorNote, Field, SelectField, friendlyError, inputClass } from "./ui-client";
import { baseOf, combos, splitList, variantName, variantSku } from "@/lib/variants";

const UNITS = ["pcs", "pair", "piece", "set", "pack", "carton", "bottle", "tin", "bag", "box", "kg", "litre", "jar", "tube", "can", "bar"];

/*
  Create or edit a product. Typing a new category name creates it.
  When creating, listing sizes and/or colours makes one product per combination
  (each with its own SKU and stock), grouped as one style. `variantOf` adds
  more sizes/colours to an existing product's style.
*/
export function ProductForm({
  product,
  variantOf,
  categories,
  suppliers,
  businessId,
  onDone,
}: {
  product?: Product;
  variantOf?: Product;
  categories: Category[];
  suppliers: Supplier[];
  businessId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const template = product ?? variantOf;
  const base = variantOf ? baseOf(variantOf) : null;
  const [cost, setCost] = useState(template?.cost_price ?? 0);
  const [price, setPrice] = useState(template?.sell_price ?? 0);
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");
  const [showVariants, setShowVariants] = useState(!!variantOf);
  const variants = combos(splitList(sizes), splitList(colors));
  const makingVariants = !product && (splitList(sizes).length > 0 || splitList(colors).length > 0);
  const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const supabase = createClient();

    let categoryId: string | null = null;
    const categoryName = String(f.get("category") ?? "").trim();
    if (categoryName) {
      const existing = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
      if (existing) categoryId = existing.id;
      else {
        const { data, error } = await supabase.from("categories").insert({ business_id: businessId, name: categoryName }).select("id").single();
        if (error) {
          setBusy(false);
          return setError(friendlyError(error.message));
        }
        categoryId = data.id;
      }
    }

    const row = {
      name: String(f.get("name")).trim(),
      sku: String(f.get("sku")).trim().toUpperCase(),
      barcode: String(f.get("barcode") ?? "").trim() || null,
      unit: String(f.get("unit")),
      cost_price: cost,
      sell_price: price,
      reorder_level: Number(f.get("reorder_level") || 0),
      supplier_id: String(f.get("supplier_id") || "") || null,
      category_id: categoryId,
    };
    let error: { message: string } | null = null;
    if (product) {
      ({ error } = await supabase.from("products").update(row).eq("id", product.id));
    } else if (makingVariants) {
      // The product we're adding to joins the style too.
      const styleId = variantOf ? (variantOf.style_id ?? variantOf.id) : crypto.randomUUID();
      if (variantOf && !variantOf.style_id) await supabase.from("products").update({ style_id: variantOf.id }).eq("id", variantOf.id);
      ({ error } = await supabase.from("products").insert(
        variants.map((v) => ({
          ...row,
          business_id: businessId,
          name: variantName(row.name, v.size, v.color),
          sku: variantSku(row.sku, v.size, v.color),
          barcode: null,
          size: v.size,
          color: v.color,
          style_id: styleId,
        })),
      ));
    } else if (variantOf) {
      error = { message: "Add at least one size or colour." };
    } else {
      ({ error } = await supabase.from("products").insert({ ...row, business_id: businessId }));
    }
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    router.refresh();
    onDone();
  }

  const currentCategory = categories.find((c) => c.id === template?.category_id)?.name ?? "";

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label={makingVariants ? "Name (sizes and colours are added for you)" : "Name"}
        name="name"
        defaultValue={base?.name ?? product?.name}
        required
        placeholder="e.g. Men's leather loafers"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU" name="sku" defaultValue={base?.sku ?? product?.sku} required placeholder="MSH-001" className="[&_input]:font-mono [&_input]:uppercase" />
        <Field label="Barcode" name="barcode" defaultValue={product?.barcode ?? ""} placeholder="Scan or type" className="[&_input]:font-mono" />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Category</span>
        <input name="category" list="category-list" defaultValue={currentCategory} placeholder="Pick or type a new one" className={inputClass} />
        <datalist id="category-list">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Unit" name="unit" defaultValue={template?.unit ?? "pcs"}>
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </SelectField>
        <Field
          label="Reorder at"
          name="reorder_level"
          type="number"
          min={0}
          step="any"
          defaultValue={template?.reorder_level ?? 5}
          hint="Flag as low at or below this."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost price" type="number" min={0} step="any" value={cost} onChange={(e) => setCost(Number(e.target.value))} required />
        <Field label="Selling price" type="number" min={0} step="any" value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
      </div>
      <p className={`text-sm ${margin < 0 ? "text-out" : "text-muted"}`}>
        Margin: <span className="font-semibold tnum">{margin}%</span> ({(price - cost).toLocaleString("en-NG")} per unit)
      </p>
      <SelectField label="Usual supplier" name="supplier_id" defaultValue={template?.supplier_id ?? ""}>
        <option value="">None</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      {!product && (
        <div className="rounded-xl border border-line bg-sunk/60 p-4">
          {!showVariants ? (
            <button type="button" onClick={() => setShowVariants(true)} className="text-sm font-semibold text-pine hover:underline">
              + This comes in sizes or colours
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Sizes and colours</p>
              <Field label="Sizes" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="e.g. 40, 41, 42, 43, 44  or  S, M, L, XL" />
              <Field label="Colours" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="e.g. Black, Brown" />
              {makingVariants ? (
                <div>
                  <p className="text-xs text-muted">
                    Creates <span className="font-semibold text-ink">{variants.length}</span> products, each with its own stock:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {variants.slice(0, 24).map((v) => (
                      <span key={`${v.size}-${v.color}`} className="rounded-md bg-panel px-2 py-0.5 text-xs ring-1 ring-line">
                        {[v.size, v.color].filter(Boolean).join(" · ")}
                      </span>
                    ))}
                    {variants.length > 24 && <span className="text-xs text-faint">+{variants.length - 24} more</span>}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-faint">Separate with commas. Every size is made in every colour.</p>
              )}
            </div>
          )}
        </div>
      )}
      <ErrorNote message={error} />
      <div className="flex gap-2 pt-2">
        <Button busy={busy} className="flex-1">
          {product ? "Save changes" : makingVariants ? `Add ${variants.length} products` : "Add product"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
