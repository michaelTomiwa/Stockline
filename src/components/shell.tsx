"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronsUpDown, LogOut, Menu, Search, X } from "lucide-react";
import { visibleNav } from "./nav";
import { setActiveStore } from "@/app/app/actions";
import { cn } from "@/lib/format";
import type { Role, Store } from "@/lib/types";
import { CommandPalette } from "./command-palette";

type ShellProps = {
  children: ReactNode;
  business: string;
  person: string;
  role: Role;
  stores: Store[];
  activeStore: string;
};

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5 text-[17px] font-bold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-citrus text-night">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h10M4 17h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </span>
      Stockline
    </span>
  );
}

function Sidebar({ role, stores, business, person, onNavigate }: Omit<ShellProps, "children" | "activeStore"> & { onNavigate?: () => void }) {
  const path = usePathname();
  const groups = visibleNav(role, stores.length);
  return (
    <div className="flex h-full flex-col bg-night text-white/80">
      <div className="px-5 pb-4 pt-5">
        <Link href="/app" onClick={onNavigate} className="text-white">
          <Logo />
        </Link>
        <p className="mt-3 truncate text-sm text-white/55">{business}</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.group || "top"} className="mt-3 first:mt-0">
            {g.group && <p className="px-3 pb-1.5 pt-2 text-xs text-white/40">{g.group}</p>}
            {g.items.map((item) => {
              const on = item.href === "/app" ? path === "/app" : path.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors",
                    on ? "text-night" : "hover:bg-white/6 hover:text-white",
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-citrus"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <Icon size={18} className="relative" />
                  <span className="relative font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <p className="truncate text-sm font-medium text-white">{person}</p>
        <p className="text-xs capitalize text-white/50">{role}</p>
        <form action="/auth/signout" method="post" className="mt-3">
          <button className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
            <LogOut size={15} /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function StoreSwitcher({ stores, activeStore }: { stores: Store[]; activeStore: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const current = stores.find((s) => s.id === activeStore);

  if (stores.length === 0) return null;

  function pick(id: string) {
    setOpen(false);
    start(async () => {
      await setActiveStore(id);
      router.refresh();
    });
  }

  const options = [...(stores.length > 1 ? [{ id: "all", name: "All stores", color: "#141a17" }] : []), ...stores];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 items-center gap-2.5 rounded-xl border border-line bg-panel pl-3 pr-2 text-sm font-semibold hover:border-pine/40",
          pending && "opacity-60",
        )}
      >
        {current ? (
          <span className="size-2.5 rounded-full" style={{ background: current.color }} />
        ) : (
          <span className="flex -space-x-1">
            {stores.slice(0, 3).map((s) => (
              <span key={s.id} className="size-2.5 rounded-full ring-2 ring-panel" style={{ background: s.color }} />
            ))}
          </span>
        )}
        <span className="max-w-36 truncate">{current?.name ?? "All stores"}</span>
        <ChevronsUpDown size={15} className="text-faint" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.ul
              role="listbox"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-xl"
            >
              {options.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => pick(s.id)}
                    role="option"
                    aria-selected={s.id === activeStore}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-sunk"
                  >
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.name}</span>
                    {s.id === activeStore && <Check size={15} className="text-pine" />}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Shell(props: ShellProps) {
  const { children, stores, activeStore, role } = props;
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = usePathname();
  // Close the mobile menu whenever the page changes.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setMobileOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
  }, [mobileOpen]);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">
        <Sidebar {...props} />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-night/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <Sidebar {...props} onNavigate={() => setMobileOpen(false)} />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="absolute right-3 top-5 rounded-lg p-1.5 text-white/70">
                <X size={20} />
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-xl sm:px-6">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="rounded-lg p-2 lg:hidden">
            <Menu size={20} />
          </button>
          <Link href="/app" className="lg:hidden">
            <Logo className="[&>span:first-child]:size-7" />
          </Link>
          <button
            onClick={() => window.dispatchEvent(new Event("open-palette"))}
            className="ml-auto flex h-10 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-sm text-faint hover:border-pine/40 lg:ml-0 lg:w-72"
          >
            <Search size={16} />
            <span className="hidden lg:inline">Search or jump to…</span>
            <kbd className="ml-auto hidden rounded bg-sunk px-1.5 py-0.5 text-[11px] lg:inline">⌘K</kbd>
          </button>
          <div className="lg:ml-auto">
            <StoreSwitcher stores={stores} activeStore={activeStore} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
      <CommandPalette role={role} storeCount={stores.length} />
    </div>
  );
}
