"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Category, Product, Supplier } from "@/lib/types";
import { Button, Drawer } from "./ui-client";
import { ProductForm } from "./product-form";

export function ProductActions({
  product,
  categories,
  suppliers,
  businessId,
}: {
  product: Product;
  categories: Category[];
  suppliers: Supplier[];
  businessId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function archive() {
    if (!confirm(`Archive ${product.name}? It disappears from lists and selling, but its history is kept.`)) return;
    setBusy(true);
    await createClient().from("products").update({ archived: true }).eq("id", product.id);
    router.push("/app/products");
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil size={15} /> Edit
      </Button>
      <Button variant="danger" onClick={archive} busy={busy}>
        <Archive size={15} /> Archive
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Edit product">
        <ProductForm product={product} categories={categories} suppliers={suppliers} businessId={businessId} onDone={() => setOpen(false)} />
      </Drawer>
    </>
  );
}
