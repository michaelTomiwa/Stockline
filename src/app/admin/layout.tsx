import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/shell";

export const metadata = { title: { default: "Admin", template: "%s · Stockline admin" } };

/* The Stockline admin area: every business on the platform. Only emails in platform_admins get in. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin !== true) notFound();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-night text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-citrus px-2.5 py-0.5 text-xs font-bold text-night">
              <ShieldCheck size={13} /> Admin
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/app" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-white/70 hover:bg-white/5 hover:text-white sm:flex">
              <ArrowLeft size={15} /> My business
            </Link>
            <span className="hidden max-w-48 truncate px-2 text-white/50 md:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-white/70 hover:bg-white/5 hover:text-white">
                <LogOut size={15} /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
