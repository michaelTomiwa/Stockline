"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { visibleNav } from "./nav";
import { cn } from "@/lib/format";
import type { Role } from "@/lib/types";

/* ⌘K / Ctrl+K anywhere: jump to a page, or search products by name or SKU. */
export function CommandPalette({ role, storeCount }: { role: Role; storeCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQ("");
        setActive(0);
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setQ("");
      setActive(0);
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-palette", onOpen);
    };
  }, []);

  const items = useMemo(() => {
    const pages = visibleNav(role, storeCount).flatMap((g) =>
      g.items.map((i) => ({ label: i.label, hint: g.group || "Page", href: i.href })),
    );
    const extra = [
      { label: "Add a product", hint: "Action", href: "/app/products?new=1" },
      { label: "Low stock", hint: "Products", href: "/app/products?status=low" },
      { label: "Out of stock", hint: "Products", href: "/app/products?status=out" },
    ];
    const all = [...pages, ...extra];
    const s = q.trim().toLowerCase();
    const matches = s ? all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(s)) : all;
    if (s.length >= 2) matches.push({ label: `Search products for “${q.trim()}”`, hint: "Products", href: `/app/products?q=${encodeURIComponent(q.trim())}` });
    return matches;
  }, [q, role, storeCount]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-night/40 px-4 pt-[12vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-label="Search"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={18} className="text-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, items.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  }
                  if (e.key === "Enter" && items[active]) go(items[active].href);
                }}
                placeholder="Pages, actions or a product name"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {items.map((it, i) => (
                <li key={it.href + it.label}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(it.href)}
                    className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[15px]", i === active && "bg-sunk")}
                  >
                    <span>{it.label}</span>
                    <span className="text-xs text-faint">{it.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
