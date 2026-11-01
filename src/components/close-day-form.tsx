"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { cn, money } from "@/lib/format";
import { Button, ErrorNote, Field, friendlyError } from "./ui-client";

/* Count the cash in the till and close the day. Closing again replaces the earlier count. */
export function CloseDayForm({
  storeId,
  expectedCash,
  currency,
  alreadyCounted,
}: {
  storeId: string;
  expectedCash: number;
  currency: string;
  alreadyCounted: number | null;
}) {
  const router = useRouter();
  const [counted, setCounted] = useState(alreadyCounted === null ? "" : String(alreadyCounted));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const diff = counted === "" ? null : Number(counted) - expectedCash;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = String(new FormData(e.currentTarget).get("note") ?? "");
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("close_day", { p_store: storeId, p_counted_cash: Number(counted), p_note: note });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <Field
        label="Cash you counted in the till"
        type="number"
        min={0}
        step="any"
        inputMode="numeric"
        value={counted}
        onChange={(e) => {
          setCounted(e.target.value);
          setSaved(false);
        }}
        required
        placeholder="e.g. 45000"
        className="[&_input]:h-12 [&_input]:text-lg"
      />
      {diff !== null && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-xl px-3 py-2.5 text-sm font-semibold",
            Math.abs(diff) < 1 ? "bg-ok/10 text-ok" : diff < 0 ? "bg-out/10 text-out" : "bg-low/10 text-low",
          )}
        >
          {Math.abs(diff) < 1
            ? "Balanced: the cash matches your sales."
            : diff < 0
              ? `Short by ${money(-diff, currency)}`
              : `Over by ${money(diff, currency)}`}
        </motion.p>
      )}
      <Field label="Note (optional)" name="note" placeholder="e.g. Gave ₦2,000 change from my pocket" />
      <ErrorNote message={error} />
      {saved && <p className="text-sm text-ok">Day closed. Your manager can see it now.</p>}
      <Button busy={busy} className="h-11 w-full">
        <Lock size={16} /> {alreadyCounted === null ? "Close my day" : "Update my count"}
      </Button>
    </form>
  );
}
