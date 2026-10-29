"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Store } from "@/lib/types";
import { Button, Drawer, ErrorNote, Field, friendlyError } from "./ui-client";
import { cn } from "@/lib/format";

const COLORS = ["#1F5F4A", "#3A6EA5", "#B7791F", "#8B3A62", "#2F855A", "#C2410C", "#5B5BD6", "#0E7490"];

export function StoreButton({ store, businessId, compact }: { store?: Store; businessId: string; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(store?.color ?? COLORS[0]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      name: String(f.get("name")).trim(),
      address: String(f.get("address") ?? "").trim() || null,
      phone: String(f.get("phone") ?? "").trim() || null,
      color,
    };
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = store
      ? await supabase.from("stores").update(row).eq("id", store.id)
      : await supabase.from("stores").insert({ ...row, business_id: businessId });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setOpen(false);
    router.refresh();
  }

  async function archive() {
    if (!store || !confirm(`Close ${store.name}? It's hidden from lists but its history is kept.`)) return;
    await createClient().from("stores").update({ archived: true }).eq("id", store.id);
    setOpen(false);
    router.push("/app/stores");
    router.refresh();
  }

  return (
    <>
      {store && compact ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-panel/90 px-2.5 text-xs font-semibold text-muted backdrop-blur hover:border-pine/40 hover:text-ink"
          aria-label={`Edit ${store.name}`}
        >
          <Pencil size={13} /> Edit
        </button>
      ) : store ? (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Pencil size={15} /> Edit store
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Add store
        </Button>
      )}
      <Drawer open={open} onClose={() => setOpen(false)} title={store ? "Edit store" : "Add a store"}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Store name" name="name" defaultValue={store?.name} required placeholder="e.g. Ikeja" />
          <Field label="Address / location" name="address" defaultValue={store?.address ?? ""} placeholder="e.g. Jogbo Street, Jebode" />
          <Field label="Phone" name="phone" type="tel" defaultValue={store?.phone ?? ""} />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">Colour</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  className={cn("size-8 rounded-full ring-offset-2 transition", color === c && "ring-2 ring-ink")}
                  style={{ background: c }}
                />
              ))}
            </div>
            <span className="mt-1 block text-xs text-faint">Used to tell stores apart in lists and charts.</span>
          </div>
          <ErrorNote message={error} />
          <Button busy={busy} className="w-full">
            {store ? "Save" : "Add store"}
          </Button>
          {store && (
            <Button type="button" variant="danger" onClick={archive} className="w-full">
              Close this store
            </Button>
          )}
        </form>
      </Drawer>
    </>
  );
}
