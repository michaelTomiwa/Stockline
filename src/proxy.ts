import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* Addresses left over from the old Elite referral site; they no longer serve anything. */
const RETIRED_HOSTS = new Set(["elite-referral.vercel.app", "elite-research-partners.vercel.app"]);

/* Keeps the Supabase session fresh; /app and /admin need a signed-in person. */
export async function proxy(request: NextRequest) {
  if (RETIRED_HOSTS.has(request.headers.get("host") ?? "")) {
    return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if ((path.startsWith("/app") || path.startsWith("/admin")) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  // An error on /login means the account can't use /app (e.g. turned off); let them sign in as someone else.
  const loginError = path === "/login" && request.nextUrl.searchParams.has("error");
  if ((path === "/login" || path === "/signup" || path === "/") && user && !loginError) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
