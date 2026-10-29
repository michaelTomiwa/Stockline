"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { Category, Product, Supplier } from "@/lib/types";
import { Button, ErrorNote, Field, SelectField, friendlyError, inputClass } from "./ui-client";

const UNITS = ["pcs", "pack", "carton", "bottle", "tin", "bag", "box", "kg", "litre", "jar", "tube", "can", "bar"];

/* Create or edit a product. Typing a new category name creates it. */
export function ProductForm({
  product,
  categories,
  suppliers,
  businessId,
  onDone,
}: {
  product?: Product;
  categories: Category[];
  suppliers: Supplier[];
  businessId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState(product?.cost_price ?? 0);
  const [price, setPrice] = useState(product?.sell_price ?? 0);
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
    const { error } = product
      ? await supabase.from("products").update(row).eq("id", product.id)
      : await supabase.from("products").insert({ ...row, business_id: businessId });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    router.refresh();
    onDone();
  }

  const currentCategory = categories.find((c) => c.id === product?.category_id)?.name ?? "";

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" name="name" defaultValue={product?.name} required placeholder="e.g. Vegetable oil 1L" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU" name="sku" defaultValue={product?.sku} required placeholder="GRO-003" className="[&_input]:font-mono [&_input]:uppercase" />
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
        <SelectField label="Unit" name="unit" defaultValue={product?.unit ?? "pcs"}>
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
          defaultValue={product?.reorder_level ?? 5}
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
      <SelectField label="Usual supplier" name="supplier_id" defaultValue={product?.supplier_id ?? ""}>
        <option value="">None</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <ErrorNote message={error} />
      <div className="flex gap-2 pt-2">
        <Button busy={busy} className="flex-1">
          {product ? "Save changes" : "Add product"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
