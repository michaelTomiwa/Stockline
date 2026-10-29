"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button, ErrorNote, Field, SelectField, friendlyError } from "./ui-client";

export function BusinessForm({ id, name, currency }: { id: string; name: string; currency: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await createClient()
      .from("businesses")
      .update({ name: String(f.get("name")).trim(), currency: String(f.get("currency")) })
      .eq("id", id);
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <Field label="Business name" name="name" defaultValue={name} required />
      <SelectField label="Currency" name="currency" defaultValue={currency}>
        {[
          ["NGN", "Naira (₦)"],
          ["GHS", "Cedi (GH₵)"],
          ["KES", "Shilling (KSh)"],
          ["USD", "US dollar ($)"],
          ["GBP", "Pound (£)"],
        ].map(([c, l]) => (
          <option key={c} value={c}>
            {l}
          </option>
        ))}
      </SelectField>
      <ErrorNote message={error} />
      <Button busy={busy}>{saved ? "Saved" : "Save"}</Button>
    </form>
  );
}
