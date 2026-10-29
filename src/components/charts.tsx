"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { compactMoney, money, shortDate } from "@/lib/format";

export type DayPoint = { day: string; revenue: number; profit: number; orders: number };

/* Daily revenue bars with profit as the darker inner bar. Hover or tap a day for details. */
export function RevenueChart({ data, currency, showProfit = true }: { data: DayPoint[]; currency: string; showProfit?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { l: 46, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const nice = Math.ceil(max / 10 ** Math.floor(Math.log10(max))) * 10 ** Math.floor(Math.log10(max));
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length);
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  const shown = hover ?? data.length - 1;
  const totalRev = data.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = data.reduce((s, d) => s + d.profit, 0);
  const point = data[shown];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{hover === null ? `Sales, last ${data.length} days` : shortDate(point.day)}</p>
          <p className="text-2xl font-bold tnum">{money(hover === null ? totalRev : point?.revenue ?? 0, currency)}</p>
        </div>
        {showProfit ? (
          <div className="text-right text-sm">
            <p className="text-muted">Profit</p>
            <p className="font-semibold text-ok tnum">{money(hover === null ? totalProfit : point?.profit ?? 0, currency)}</p>
          </div>
        ) : (
          <div className="text-right text-sm">
            <p className="text-muted">Sales</p>
            <p className="font-semibold tnum">{hover === null ? data.reduce((s, d) => s + d.orders, 0) : point?.orders ?? 0}</p>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sales by day" onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(nice * t)} y2={y(nice * t)} stroke="#e0e4dc" strokeDasharray={t ? "3 4" : undefined} />
            <text x={pad.l - 8} y={y(nice * t) + 4} textAnchor="end" fontSize="11" fill="#8b948e">
              {compactMoney(nice * t, currency)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const dim = hover !== null && hover !== i;
          return (
            <g key={d.day} onPointerEnter={() => setHover(i)} style={{ cursor: "default" }}>
              <rect x={pad.l + i * bw} y={0} width={bw} height={H} fill="transparent" />
              <motion.rect
                x={x}
                width={w}
                rx={Math.min(3, w / 3)}
                fill="#1f5f4a"
                opacity={dim ? 0.35 : 0.85}
                initial={{ y: y(0), height: 0 }}
                animate={{ y: y(d.revenue), height: y(0) - y(d.revenue) }}
                transition={{ duration: 0.6, delay: i * 0.012, ease: [0.22, 1, 0.36, 1] }}
              />
              {showProfit && (
                <motion.rect
                  x={x}
                  width={w}
                  rx={Math.min(3, w / 3)}
                  fill="#d6f26b"
                  opacity={dim ? 0.4 : 1}
                  initial={{ y: y(0), height: 0 }}
                  animate={{ y: y(Math.max(0, d.profit)), height: y(0) - y(Math.max(0, d.profit)) }}
                  transition={{ duration: 0.6, delay: 0.15 + i * 0.012, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              {(i === 0 || i === data.length - 1 || (i % 7 === 0 && data.length - 1 - i >= 4)) && (
                <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#8b948e">
                  {shortDate(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-pine" /> Revenue
        </span>
        {showProfit && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-citrus" /> Profit
          </span>
        )}
      </div>
    </div>
  );
}

/* Proportional bar for stock health: healthy / low / out. */
export function HealthBar({ ok, low, out }: { ok: number; low: number; out: number }) {
  const total = Math.max(1, ok + low + out);
  const seg = [
    { v: ok, c: "bg-ok" },
    { v: low, c: "bg-low" },
    { v: out, c: "bg-out" },
  ];
  return (
    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-sunk">
      {seg.map((s, i) =>
        s.v > 0 ? (
          <motion.span
            key={i}
            className={s.c}
            initial={{ width: 0 }}
            whileInView={{ width: `${(s.v / total) * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : null,
      )}
    </div>
  );
}
