"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Store } from "@/lib/types";
import { Button, ErrorNote, Field, SelectField, friendlyError, inputClass } from "./ui-client";

export function InviteForm({ businessId, stores }: { businessId: string; stores: Store[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const email = String(f.get("email")).trim().toLowerCase();
    setBusy(true);
    setError(null);
    const { error } = await createClient()
      .from("invites")
      .insert({ business_id: businessId, email, role: String(f.get("role")), store_id: String(f.get("store_id")) || null });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setSent(email);
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <Field label="Email" name="email" type="email" required placeholder="name@example.com" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Role" name="role" defaultValue="staff">
          <option value="staff">Staff</option>
          <option value="manager">Manager</option>
        </SelectField>
        <SelectField label="Store" name="store_id" defaultValue={stores[0]?.id ?? ""}>
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>
      <ErrorNote message={error} />
      {sent && (
        <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">
          Invite saved. Ask {sent} to create an account at this site with that email; they&rsquo;ll join your business automatically.
        </p>
      )}
      <Button busy={busy} className="w-full">
        <UserPlus size={16} /> Invite
      </Button>
    </form>
  );
}

export function MemberControls({ userId, role, storeId, stores }: { userId: string; role: string; storeId: string | null; stores: Store[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update(patch: Record<string, string | null>) {
    setBusy(true);
    await createClient().from("members").update(patch).eq("user_id", userId);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Remove this person? They'll lose access straight away.")) return;
    setBusy(true);
    await createClient().from("members").delete().eq("user_id", userId);
    router.refresh();
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${busy ? "opacity-60" : ""}`}>
      <select value={role} onChange={(e) => update({ role: e.target.value })} className={`${inputClass} h-9 w-auto`} aria-label="Role">
        <option value="staff">Staff</option>
        <option value="manager">Manager</option>
      </select>
      <select value={storeId ?? ""} onChange={(e) => update({ store_id: e.target.value || null })} className={`${inputClass} h-9 w-auto`} aria-label="Store">
        <option value="">All stores</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button onClick={remove} className="rounded-lg p-2 text-faint hover:bg-out/10 hover:text-out" aria-label="Remove">
        <X size={16} />
      </button>
    </div>
  );
}

export function CancelInvite({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().from("invites").delete().eq("id", id);
        router.refresh();
      }}
      className="text-sm text-muted hover:text-out"
    >
      Cancel
    </button>
  );
}
