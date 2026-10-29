import Link from "next/link";
import { ArrowLeftRight, BellRing, ClipboardCheck, History, ScanBarcode, Users } from "lucide-react";
import { Logo } from "@/components/shell";
import { FadeIn, HeroLines, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { HeroAlerts } from "@/components/hero-alerts";

const features = [
  { icon: BellRing, title: "Low-stock alerts", body: "Every product has a reorder level. Stockline tells you what's low, at which store, and how much to order." },
  { icon: ArrowLeftRight, title: "Transfers between stores", body: "Move stock from one branch to another in a few taps. Both stores update at once." },
  { icon: ScanBarcode, title: "Fast selling", body: "Search, scan a barcode or type a SKU. Sales take stock out the moment they're recorded." },
  { icon: History, title: "A full history", body: "Every item in or out is recorded with who did it and when. Nothing changes without a trace." },
  { icon: ClipboardCheck, title: "Stock counts", body: "Count what's on the shelf; the difference is logged as an adjustment with a reason." },
  { icon: Users, title: "Your team, your rules", body: "Invite managers and staff to the stores they work in. Only you see every store." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-xl bg-pine px-4 py-2 text-sm font-semibold text-white hover:bg-pine-deep">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.2fr_1fr]">
        <div>
        <HeroLines
          lines={["Every store.", "Every shelf.", "One screen."]}
          className="text-[clamp(44px,8vw,92px)] font-bold leading-[0.95] tracking-[-0.04em]"
        />
        <FadeIn delay={0.45}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Stockline is inventory for business owners with more than one store. See what came in, what sold, what moved
            between branches and what&rsquo;s about to run out, all in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-xl bg-pine px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-pine-deep">
              Create your business
            </Link>
            <Link href="/login" className="rounded-xl border border-line bg-panel px-6 py-3.5 font-semibold transition hover:-translate-y-0.5">
              Sign in
            </Link>
          </div>
        </FadeIn>
        </div>
        <HeroAlerts />
      </section>

      <section className="bg-night py-16 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <StoreBoard />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="max-w-lg text-3xl font-bold tracking-tight sm:text-4xl">Built for the way you actually run your shops</h2>
        </Reveal>
        <Stagger className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <f.icon size={22} className="text-pine" />
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted">{f.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-8 text-sm text-faint sm:px-6">
          <p>© 2026 Stockline</p>
          <p>Try it with sample data after you sign up.</p>
        </div>
      </footer>
    </div>
  );
}

/* A still of the overview: three stores and the health of their shelves. */
function StoreBoard() {
  const stores = [
    { name: "Ikeja", value: "₦4.8m", ok: 28, low: 6, out: 2, color: "#1F5F4A" },
    { name: "Lekki", value: "₦3.9m", ok: 31, low: 4, out: 1, color: "#3A6EA5" },
    { name: "Wuse 2, Abuja", value: "₦3.2m", ok: 25, low: 8, out: 3, color: "#B7791F" },
  ];
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
      <div>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">See which store needs you today</h2>
        <p className="mt-3 max-w-md text-white/65">
          The overview lines up your stores side by side: stock value, what&rsquo;s healthy, what&rsquo;s low and what&rsquo;s gone.
        </p>
      </div>
      <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 sm:p-6">
        {stores.map((s) => {
          const total = s.ok + s.low + s.out;
          return (
            <div key={s.name} className="border-b border-white/10 py-4 first:pt-0 last:border-0 last:pb-0">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="text-white/70">{s.value} in stock</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
                <span style={{ width: `${(s.ok / total) * 100}%` }} className="bg-citrus" />
                <span style={{ width: `${(s.low / total) * 100}%` }} className="bg-low" />
                <span style={{ width: `${(s.out / total) * 100}%` }} className="bg-out" />
              </div>
              <p className="mt-2 text-sm text-white/55 tnum">
                {s.ok} healthy · {s.low} low · {s.out} out
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
