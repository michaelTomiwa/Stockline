import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Where email links (confirm account, reset password) land. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=expired", url.origin));
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
