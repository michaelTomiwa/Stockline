import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import type { StockStatus } from "@/lib/types";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-panel", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const statusStyle: Record<StockStatus, string> = {
  ok: "bg-ok/10 text-ok",
  low: "bg-low/12 text-low",
  out: "bg-out/10 text-out",
};
const statusLabel: Record<StockStatus, string> = { ok: "In stock", low: "Low", out: "Out" };

export function StatusBadge({ status }: { status: StockStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", statusStyle[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabel[status]}
    </span>
  );
}

export function StoreDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
        variant === "primary" ? "bg-pine text-white hover:bg-pine-deep" : "border border-line bg-panel text-ink hover:border-pine/40 hover:bg-sunk",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-[15px] text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const th = "px-4 py-2.5 text-left text-xs font-semibold text-muted";
export const td = "px-4 py-3";
