import { hardenAuthCookieOptions } from "@/lib/supabase/cookie-options";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Request proxy (the Next.js 16 replacement for `middleware.ts`).
 *
 * Its ONLY jobs are:
 *   1. refresh the Supabase auth cookie so sessions do not expire mid-visit;
 *   2. bounce clearly-unauthenticated visitors to /login before rendering.
 *
 * It is NOT an authorization boundary. Per the Next.js data-security guidance,
 * Server Functions are POSTs to the page route and a matcher change can quietly
 * remove proxy coverage, so every page, Server Action and Route Handler
 * enforces its own permission check via src/lib/auth/authorize.ts. Treat this
 * file as a UX and session-hygiene concern only.
 */

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
  "/error",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Unconfigured environment: do not pretend to authenticate anyone. Pages
  // themselves render a configuration notice; blocking here would make the
  // problem harder to diagnose, and no protected data is reachable regardless
  // because every page performs its own server-side check.
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenAuthCookieOptions(options, process.env.NODE_ENV === "production"));
        }
      },
    },
  });

  // getSession() reads and decodes the cookie locally — no network round trip
  // to Supabase Auth. That is normally unsafe for a trust decision, but this
  // proxy makes none: it is explicitly NOT the authorization boundary (see the
  // file header), only a UX redirect for the obviously-signed-out case. The
  // real, security-relevant check is `getCurrentActor()`'s `auth.getUser()`
  // call, which every page still performs. A forged or expired cookie that
  // slips past this cheap check is caught there a moment later — nothing here
  // is ever trusted with data access. Using `getUser()` here as well would
  // add a second full network hop to Supabase Auth on every navigation for no
  // additional security, which is exactly what made page switches feel slow.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const { pathname } = request.nextUrl;

  if (!user && !isPublicRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Preserve intent so the user lands where they were going after signing in.
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and metadata files. Auth cookies must be
     * refreshed on real page requests, not on image or font fetches.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
