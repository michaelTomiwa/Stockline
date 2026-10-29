import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "../shell";

/* Split screen: the form on the left, a quiet product moment on the right. */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mb-8 mt-2 text-muted">{subtitle}</p>
          {children}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-night lg:block">
        <ShelfArt />
      </div>
    </main>
  );
}

/* Stylised shelves: each row a store, each block a product, coloured by stock health. */
function ShelfArt() {
  const rows = [
    { name: "Ikeja", blocks: [9, 7, 2, 8, 6, 0, 9, 5, 7] },
    { name: "Lekki", blocks: [6, 8, 9, 1, 7, 8, 4, 9, 6] },
    { name: "Wuse 2", blocks: [8, 3, 7, 9, 0, 6, 8, 7, 2] },
  ];
  const color = (n: number) => (n === 0 ? "#c2410c" : n <= 3 ? "#b7791f" : "#d6f26b");
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-10 px-16">
      {rows.map((r) => (
        <div key={r.name}>
          <p className="mb-3 text-sm text-white/50">{r.name}</p>
          <div className="flex items-end gap-2.5 border-b-2 border-white/15 pb-1">
            {r.blocks.map((n, i) => (
              <span
                key={i}
                className="w-9 rounded-t-md"
                style={{ height: 14 + n * 9, background: color(n), opacity: n === 0 ? 0.9 : 0.35 + n / 15 }}
              />
            ))}
          </div>
        </div>
      ))}
      <p className="max-w-sm text-lg leading-relaxed text-white/75">
        Every store, every shelf, on one screen. Know what&rsquo;s selling, what&rsquo;s running low and where your stock went.
      </p>
    </div>
  );
}
