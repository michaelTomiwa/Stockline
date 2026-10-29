"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Download } from "lucide-react";
import type { Store } from "@/lib/types";
import { cn } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { Button, inputClass } from "./ui-client";

const TYPES = [
  ["all", "Everything"],
  ["sale", "Sales"],
  ["receive", "Deliveries"],
  ["transfer", "Transfers"],
  ["adjust", "Adjustments"],
] as const;

export function MovementFilters({ stores, csv }: { stores: Store[]; csv: { head: string[]; rows: (string | number)[][] } }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value === "all" || !value) next.delete(key);
    else next.set(key, value);
    start(() => router.push(`/app/movements?${next.toString()}`));
  }

  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", pending && "opacity-60")}>
      <div className="flex overflow-x-auto rounded-xl border border-line bg-panel p-1 text-sm">
        {TYPES.map(([k, label]) => (
          <button
            key={k}
            onClick={() => set("type", k)}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 font-medium",
              (params.get("type") ?? "all") === k ? "bg-night text-white" : "text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {stores.length > 1 && (
        <select value={params.get("store") ?? "all"} onChange={(e) => set("store", e.target.value)} className={cn(inputClass, "w-auto bg-panel")} aria-label="Store">
          <option value="all">All stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <select value={params.get("days") ?? "30"} onChange={(e) => set("days", e.target.value)} className={cn(inputClass, "w-auto bg-panel")} aria-label="Period">
        <option value="1">Today</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="365">Last year</option>
      </select>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          set("q", String(new FormData(e.currentTarget).get("q") ?? "").trim());
        }}
        className="min-w-48 flex-1"
      >
        <input name="q" defaultValue={params.get("q") ?? ""} placeholder="Product, SKU or reference, then Enter" className={cn(inputClass, "bg-panel")} />
      </form>
      <Button variant="secondary" onClick={() => downloadCsv("stock-history.csv", csv.head, csv.rows)}>
        <Download size={16} /> Export
      </Button>
    </div>
  );
}
