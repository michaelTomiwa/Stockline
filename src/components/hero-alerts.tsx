"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, PackagePlus, ShoppingCart, TriangleAlert } from "lucide-react";

/* A still of the kinds of things Stockline tells you during the day, dealt in one by one. */
const cards = [
  { icon: TriangleAlert, tone: "text-out bg-out/10", title: "Vegetable oil 1L is low at Ikeja", body: "6 left · reorder 24 from Northern Foods" },
  { icon: ShoppingCart, tone: "text-pine bg-pine/10", title: "Sale at Lekki · ₦18,400", body: "4 items · 2 minutes ago" },
  { icon: ArrowLeftRight, tone: "text-move bg-move/10", title: "12 × Toothpaste sent to Wuse 2", body: "From Ikeja · arrives today" },
  { icon: PackagePlus, tone: "text-ok bg-ok/10", title: "Delivery received at Ikeja", body: "36 cartons · invoice INV-4013" },
];

export function HeroAlerts() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0">
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-citrus/40 blur-3xl" />
      <div className="space-y-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 24, rotate: i % 2 ? 1.5 : -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.6 + i * 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-4 shadow-[0_12px_40px_-16px_rgba(15,32,26,0.25)]"
            style={{ marginLeft: i % 2 ? 24 : 0, marginRight: i % 2 ? 0 : 24 }}
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${c.tone}`}>
              <c.icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{c.title}</p>
              <p className="truncate text-sm text-muted">{c.body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
