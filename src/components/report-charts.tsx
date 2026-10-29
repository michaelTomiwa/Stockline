"use client";

import { motion } from "framer-motion";
import { compactMoney, money } from "@/lib/format";

/* Horizontal bars comparing stores (or categories) by revenue, with profit inside. */
export function CompareBars({
  rows,
  currency,
}: {
  rows: { label: string; color: string; revenue: number; profit: number; sub?: string }[];
  currency: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <ul className="space-y-4">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <span className="size-2.5 rounded-full" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="tnum">
              <span className="font-semibold">{money(r.revenue, currency)}</span>
              <span className="ml-2 text-ok">{money(r.profit, currency)} profit</span>
            </span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-sunk">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: r.color, opacity: 0.35 }}
              initial={{ width: 0 }}
              whileInView={{ width: `${(r.revenue / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: r.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${(Math.max(0, r.profit) / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {r.sub && <p className="mt-1 text-xs text-faint">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/* Donut showing where stock value sits (by category). */
export function Donut({ parts, currency }: { parts: { label: string; value: number; color: string }[]; currency: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const R = 54;
  const C = 2 * Math.PI * R;
  const segments = parts.map((p, i) => {
    const len = (p.value / total) * C;
    const start = parts.slice(0, i).reduce((s, q) => s + (q.value / total) * C, 0);
    return { ...p, len, start };
  });
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <svg viewBox="0 0 140 140" className="size-40 shrink-0 -rotate-90" role="img" aria-label="Stock value by category">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f7f8f5" strokeWidth="18" />
        {segments.map((p, i) => (
          <motion.circle
            key={p.label}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={p.color}
            strokeWidth="18"
            strokeDasharray={`${p.len} ${C - p.len}`}
            strokeDashoffset={-p.start}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          />
        ))}
      </svg>
      <ul className="w-full space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span className="flex-1 truncate">{p.label}</span>
            <span className="tnum text-muted">{Math.round((p.value / total) * 100)}%</span>
            <span className="w-20 text-right font-semibold tnum">{compactMoney(p.value, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Busiest hours of the week: a 7 × 13 heatmap of orders (8am–8pm). */
export function Heatmap({ cells }: { cells: number[][] }) {
  const max = Math.max(1, ...cells.flat());
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 13 }, (_, i) => 8 + i);
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid min-w-full gap-1" style={{ gridTemplateColumns: `2.5rem repeat(${hours.length}, minmax(1.6rem, 1fr))` }}>
        <span />
        {hours.map((h) => (
          <span key={h} className="text-center text-[10px] text-faint">
            {h > 12 ? h - 12 : h}
            {h >= 12 ? "p" : "a"}
          </span>
        ))}
        {days.map((d, di) => (
          <div key={d} className="contents">
            <span className="self-center text-xs text-muted">{d}</span>
            {hours.map((h, hi) => {
              const v = cells[di]?.[hi] ?? 0;
              return (
                <motion.span
                  key={h}
                  title={`${d} ${h}:00 · ${v} sales`}
                  className="aspect-square rounded-[5px]"
                  style={{ background: v ? `rgba(31, 95, 74, ${0.12 + (v / max) * 0.88})` : "#f7f8f5" }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: (di * hours.length + hi) * 0.004 }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
