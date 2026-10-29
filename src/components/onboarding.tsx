"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Button, ErrorNote } from "./ui-client";

/* First run: start from scratch or explore with sample data. */
export function Onboarding({ isOwner, hasStores }: { isOwner: boolean; hasStores: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDemo() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("load_demo_data");
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-8 text-center">
        <p className="text-lg font-semibold">Nothing here yet</p>
        <p className="mt-1 text-muted">The owner hasn&rsquo;t added products yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl bg-night p-7 text-white">
        <Sparkles className="text-citrus" />
        <h2 className="mt-4 text-xl font-bold">Explore with sample data</h2>
        <p className="mt-2 text-white/70">
          We&rsquo;ll add 3 stores, 36 products and two months of sales, deliveries and transfers so you can see how everything
          works. Best on a fresh account.
        </p>
        <Button onClick={loadDemo} busy={busy} disabled={hasStores} className="mt-6 bg-citrus text-night hover:bg-citrus/90">
          Load sample data
        </Button>
        {hasStores && <p className="mt-3 text-sm text-white/55">Available only before you add your own stores.</p>}
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-panel p-7">
        <Store className="text-pine" />
        <h2 className="mt-4 text-xl font-bold">Start with your own</h2>
        <ol className="mt-3 space-y-2 text-muted">
          <li>
            1. <Link href="/app/stores" className="font-semibold text-pine hover:underline">Add your stores</Link>
          </li>
          <li>
            2. <Link href="/app/products?new=1" className="font-semibold text-pine hover:underline">Add your products</Link> with prices and reorder levels
          </li>
          <li>
            3. <Link href="/app/receive" className="font-semibold text-pine hover:underline">Receive your opening stock</Link> at each store
          </li>
        </ol>
      </div>
    </div>
  );
}
