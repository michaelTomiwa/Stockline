"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Supplier } from "@/lib/types";
import { Button, Drawer, ErrorNote, Field, friendlyError, inputClass } from "./ui-client";

export function SupplierButton({ supplier, businessId }: { supplier?: Supplier; businessId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const val = (k: string) => String(f.get(k) ?? "").trim() || null;
    const row = { name: String(f.get("name")).trim(), contact_name: val("contact_name"), phone: val("phone"), email: val("email"), notes: val("notes") };
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = supplier
      ? await supabase.from("suppliers").update(row).eq("id", supplier.id)
      : await supabase.from("suppliers").insert({ ...row, business_id: businessId });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {supplier ? (
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-sunk hover:text-ink" aria-label={`Edit ${supplier.name}`}>
          <Pencil size={15} />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Add supplier
        </Button>
      )}
      <Drawer open={open} onClose={() => setOpen(false)} title={supplier ? "Edit supplier" : "Add a supplier"}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Company name" name="name" defaultValue={supplier?.name} required />
          <Field label="Contact person" name="contact_name" defaultValue={supplier?.contact_name ?? ""} />
          <Field label="Phone or WhatsApp" name="phone" type="tel" defaultValue={supplier?.phone ?? ""} />
          <Field label="Email" name="email" type="email" defaultValue={supplier?.email ?? ""} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">Notes</span>
            <textarea name="notes" rows={3} defaultValue={supplier?.notes ?? ""} placeholder="Payment terms, delivery days…" className={`${inputClass} h-auto py-2`} />
          </label>
          <ErrorNote message={error} />
          <Button busy={busy} className="w-full">
            {supplier ? "Save" : "Add supplier"}
          </Button>
        </form>
      </Drawer>
    </>
  );
}
