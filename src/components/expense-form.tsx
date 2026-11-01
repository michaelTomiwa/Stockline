"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Store } from "@/lib/types";
import { Button, Drawer, ErrorNote, Field, SelectField, friendlyError, inputClass } from "./ui-client";

export const EXPENSE_CATEGORIES = ["Rent", "Salaries", "Electricity / NEPA", "Fuel / diesel", "Transport / logistics", "Repairs", "Supplies", "Marketing", "Bank charges", "Taxes / levies", "Other"];

export function AddExpenseButton({
  businessId,
  stores,
  allowBusinessWide,
  defaultStore,
  today,
}: {
  businessId: string;
  stores: Store[];
  allowBusinessWide: boolean;
  defaultStore?: string;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({
      business_id: businessId,
      store_id: String(f.get("store_id") || "") || null,
      category: String(f.get("category")).trim() || "Other",
      amount: Number(f.get("amount")),
      spent_on: String(f.get("spent_on")),
      note: String(f.get("note") ?? "").trim() || null,
      created_by: user?.id,
    });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> Add expense
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Add an expense">
        {open && (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Amount" name="amount" type="number" min={1} step="any" inputMode="numeric" required autoFocus placeholder="e.g. 150000" className="[&_input]:h-12 [&_input]:text-lg" />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">What for</span>
              <input name="category" list="expense-categories" required placeholder="Pick or type" className={inputClass} />
              <datalist id="expense-categories">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Store" name="store_id" defaultValue={defaultStore ?? (allowBusinessWide ? "" : stores[0]?.id)}>
                {allowBusinessWide && <option value="">Whole business</option>}
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectField>
              <Field label="Date" name="spent_on" type="date" defaultValue={today} max={today} required />
            </div>
            <Field label="Note (optional)" name="note" placeholder="e.g. October shop rent" />
            <ErrorNote message={error} />
            <Button busy={busy} className="h-11 w-full">
              Save expense
            </Button>
          </form>
        )}
      </Drawer>
    </>
  );
}

/* Expenses are never deleted; a mistake is voided so the record stays. */
export function VoidExpense({ id, voided }: { id: string; voided: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!voided && !confirm("Void this expense? It stops counting but stays on record.")) return;
        setBusy(true);
        await createClient().from("expenses").update({ voided: !voided }).eq("id", id);
        setBusy(false);
        router.refresh();
      }}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-sunk hover:text-ink disabled:opacity-50"
    >
      <Undo2 size={13} /> {voided ? "Restore" : "Void"}
    </button>
  );
}
