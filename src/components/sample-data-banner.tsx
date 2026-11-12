"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { qty } from "@/lib/format";
import { Button, ErrorNote, friendlyError } from "./ui-client";

export type SampleSummary = { stores: string[]; products: number; movements: number; suppliers: number };

/* Shown to an owner whose business still holds the "Explore with sample data" stores and sales. */
export function SampleDataBanner({ summary, businessId }: { summary: SampleSummary; businessId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function clear() {
    if (
      !confirm(
        `Remove the sample data?\n\nThis deletes the sample stores (${summary.stores.join(", ")}) and their ${summary.movements ? `${qty(summary.movements)} ` : ""}made-up sales and deliveries, and hides the sample products.\n\nYour own stores and products are not touched.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = businessId ? await supabase.rpc("admin_clear_sample_data", { p_business: businessId }) : await supabase.rpc("clear_sample_data");
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok/10 px-5 py-4 text-sm">
        <CircleCheck size={20} className="shrink-0 text-ok" />
        <p>Sample data removed. Your figures now show only your own business.</p>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-citrus/50 bg-citrus/15 px-5 py-4">
      <FlaskConical size={22} className="shrink-0 text-night" />
      <div className="min-w-0 flex-1 basis-64 text-sm">
        <p className="font-semibold">{businessId ? "This business still has the sample data" : "You still have the sample data in your account"}</p>
        <p className="mt-0.5 text-muted">
          The stores {summary.stores.join(", ")} and {summary.movements ? `${qty(summary.movements)} ` : "their "}made-up sales are mixed into the sales, profit and
          stock figures. Remove them so only the real business shows.
        </p>
        <ErrorNote message={error} />
      </div>
      <Button onClick={clear} busy={busy} className="bg-night text-white hover:bg-night/90">
        Remove sample data
      </Button>
    </div>
  );
}
