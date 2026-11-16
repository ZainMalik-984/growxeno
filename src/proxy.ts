import { decideRoute, hostModeFor, type HostMode, type RouteDecision } from "@/lib/routing/hosts";
import { hardenAuthCookieOptions } from "@/lib/supabase/cookie-options";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Request proxy (the Next.js 16 replacement for `middleware.ts`).
 *
 * Its ONLY jobs are:
 *   1. route by hostname (2026-11-17): growxeno.com serves the public homepage
 *      and sends everything else to app.growxeno.com, where the dashboard
 *      renders at "/" (a rewrite, so the address bar stays "/"); the rules are
 *      in src/lib/routing/hosts.ts and switch on with NEXT_PUBLIC_SITE_URL;
 *   2. refresh the Supabase auth cookie so sessions do not expire mid-visit;
 *   3. bounce clearly-unauthenticated visitors to /login before rendering.
 *
 * It is NOT an authorization boundary. Per the Next.js data-security guidance,
 * Server Functions are POSTs to the page route and a matcher change can quietly
 * remove proxy coverage, so every page, Server Action and Route Handler
 * enforces its own permission check via src/lib/auth/authorize.ts. Treat this
 * file as a UX and session-hygiene concern only.
 */

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/** Turn a decision into a response, carrying over any refreshed auth cookies. */
function respond(request: NextRequest, decision: RouteDecision, base: NextResponse, mode: HostMode): NextResponse {
  let out: NextResponse;
  if (decision.kind === "redirect") {
    out = NextResponse.redirect(new URL(decision.location, request.url), decision.permanent ? 308 : 307);
  } else if (decision.kind === "rewrite") {
    const target = request.nextUrl.clone();
    target.pathname = decision.pathname;
    out = NextResponse.rewrite(target, { request });
  } else {
    out = base;
  }
  if (out !== base) {
    for (const cookie of base.cookies.getAll()) out.cookies.set(cookie);
  }
  // The management app is never for search engines (its pages are also noindex in their metadata).
  if (mode === "app") out.headers.set("X-Robots-Tag", "noindex, nofollow");
  return out;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const mode = hostModeFor(request.headers.get("host"), process.env.NEXT_PUBLIC_SITE_URL);
  const { pathname, search } = request.nextUrl;

  // The public site never needs the session: answer straight away.
  if (mode === "site") {
    return respond(request, decideRoute({ mode, pathname, search, signedIn: null, appUrl: appUrl() }), NextResponse.next({ request }), mode);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Unconfigured environment: do not pretend to authenticate anyone. Pages
  // themselves render a configuration notice; blocking here would make the
  // problem harder to diagnose, and no protected data is reachable regardless
  // because every page performs its own server-side check.
  if (!url || !key) {
    return respond(request, decideRoute({ mode, pathname, search, signedIn: null, appUrl: appUrl() }), response, mode);
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
  // real, security-relevant check is `getCurrentActor()`'s `auth.getClaims()`
  // (signature-verified against Supabase's published key since 2026-11-03)
  // call, which every page still performs. A forged or expired cookie that
  // slips past this cheap check is caught there a moment later — nothing here
  // is ever trusted with data access. Using `getUser()` here as well would
  // add a second full network hop to Supabase Auth on every navigation for no
  // additional security, which is exactly what made page switches feel slow.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return respond(request, decideRoute({ mode, pathname, search, signedIn: Boolean(session?.user), appUrl: appUrl() }), response, mode);
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
