"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { sendTestSaleEmail } from "@/app/app/actions";
import { cn } from "@/lib/format";
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

export function EmailAlertsForm({
  id,
  enabled,
  minAmount,
  notifyEmail,
  ownerEmail,
  configured,
  currency,
}: {
  id: string;
  enabled: boolean;
  minAmount: number;
  notifyEmail: string | null;
  ownerEmail: string;
  configured: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setNote(null);
    const { error } = await createClient()
      .from("businesses")
      .update({
        sale_emails: on,
        sale_email_min: Number(f.get("min") || 0),
        notify_email: String(f.get("email") ?? "").trim() || null,
      })
      .eq("id", id);
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setNote("Saved.");
    router.refresh();
  }

  async function test(form: HTMLFormElement | null) {
    const to = String(new FormData(form ?? undefined).get("email") ?? "").trim() || ownerEmail;
    setTesting(true);
    setError(null);
    setNote(null);
    const res = await sendTestSaleEmail(to);
    setTesting(false);
    if (!res.ok) return setError(res.error ?? "Couldn't send the test email.");
    setNote(`Test email sent to ${to}. Check your inbox (and spam).`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      {!configured && (
        <p className="rounded-xl bg-low/10 px-3 py-2.5 text-sm text-low">
          Email sending isn&rsquo;t connected yet, so nothing will be sent. Your settings are still saved.
        </p>
      )}
      <label className="flex cursor-pointer items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => setOn((v) => !v)}
          className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-pine" : "bg-line")}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
        </button>
        <span>
          <span className="block font-medium">Email me when a sale is made</span>
          <span className="block text-sm text-muted">
            Each sale by your salespeople, managers or staff: what was sold, where, by whom, and today&rsquo;s running total. Your own sales aren&rsquo;t emailed.
          </span>
        </span>
      </label>
      <div className={cn("grid gap-3 sm:grid-cols-2", !on && "pointer-events-none opacity-50")}>
        <Field label="Send to" name="email" type="email" defaultValue={notifyEmail ?? ""} placeholder={ownerEmail} hint="Leave empty to use your sign-in email." />
        <Field
          label={`Only sales over (${currency})`}
          name="min"
          type="number"
          min={0}
          step={500}
          defaultValue={minAmount || ""}
          placeholder="0"
          hint="Optional. Skip small sales on busy days."
        />
      </div>
      <ErrorNote message={error} />
      {note && <p className="text-sm text-ok">{note}</p>}
      <div className="flex flex-wrap gap-2">
        <Button busy={busy}>Save</Button>
        <Button type="button" variant="secondary" busy={testing} disabled={!configured} onClick={(e) => test(e.currentTarget.form)}>
          <Mail size={16} /> Send a test email
        </Button>
      </div>
    </form>
  );
}
