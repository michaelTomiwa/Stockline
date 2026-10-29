"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, LoaderCircle, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/format";

export const inputClass =
  "h-10 w-full rounded-xl border border-line bg-sunk px-3 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-pine focus:bg-panel";

export function Field({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <input {...props} className={inputClass} />
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  children,
  className,
  ...props
}: { label: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <select {...props} className={inputClass}>
        {children}
      </select>
    </label>
  );
}

export function Button({
  busy,
  children,
  variant = "primary",
  className,
  ...props
}: { busy?: boolean; variant?: "primary" | "secondary" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60",
        variant === "primary" && "bg-pine text-white hover:bg-pine-deep",
        variant === "secondary" && "border border-line bg-panel hover:border-pine/40 hover:bg-sunk",
        variant === "danger" && "border border-out/30 bg-panel text-out hover:bg-out/5",
        className,
      )}
    >
      {busy && <LoaderCircle size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-start gap-2 overflow-hidden text-sm text-out"
        >
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/* Side panel for create/edit forms. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-night/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-label={title}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-panel shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-sunk">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* Turn a Postgres/PostgREST error into something a shop owner can act on. */
export function friendlyError(message: string) {
  if (message.includes("duplicate key") && message.includes("sku")) return "Another product already uses that SKU.";
  if (message.includes("duplicate key")) return "That already exists.";
  if (message.includes("row-level security")) return "Your role doesn't allow this. Ask the owner.";
  return message;
}
