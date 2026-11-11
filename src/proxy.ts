import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast gate for /admin and /api/admin: no session cookie -> login page / 401.
 * The session itself and admin rights are verified server-side on every request
 * (admin layout, API routes via getAdmin()) and again by RLS in the database.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && !isLogin) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const to = new URL("/admin/login", request.url);
    to.searchParams.set("next", pathname + search);
    return NextResponse.redirect(to);
  }
  const res = NextResponse.next();
  res.headers.set("x-robots-tag", "noindex, nofollow");
  res.headers.set("cache-control", "private, no-store");
  return res;
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
