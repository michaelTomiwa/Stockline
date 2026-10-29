import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <p className="text-6xl font-bold tracking-tight text-pine">404</p>
        <h1 className="mt-3 text-xl font-bold">This page isn&rsquo;t here</h1>
        <p className="mt-1 text-muted">It may have moved, or your role doesn&rsquo;t include it.</p>
        <Link href="/app" className="mt-6 inline-flex h-10 items-center rounded-xl bg-pine px-4 text-sm font-semibold text-white">
          Back to overview
        </Link>
      </div>
    </main>
  );
}
