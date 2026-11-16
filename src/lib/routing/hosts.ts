/**
 * Two domains, one application (2026-11-17).
 *
 *   growxeno.com      the public website: only the homepage (and /api/*)
 *   app.growxeno.com  the management application, with the dashboard at "/"
 *
 * The split switches on when NEXT_PUBLIC_SITE_URL is set (the public site's
 * URL; NEXT_PUBLIC_APP_URL is the app's). Until then everything behaves as one
 * domain, as before ("combined": homepage at "/", dashboard at "/dashboard"),
 * so nothing changes before the subdomain is live. Locally the same split can
 * be tried with http://localhost:3000 and http://app.localhost:3000.
 *
 * Pure (no server-only) so the rules are unit-tested; src/proxy.ts applies them.
 * The proxy is not a security boundary: every page, server action and route
 * handler still checks permissions itself.
 */

export type HostMode = "combined" | "site" | "app";

/** Where the dashboard lives: the app's root once the split is on, /dashboard before. Inlined at build. */
export const DASHBOARD_PATH: string = process.env.NEXT_PUBLIC_SITE_URL ? "/" : "/dashboard";

/**
 * The public homepage, for links from the app ("Back to website"): the site's own
 * domain once the split is on (on the app host "/" is the dashboard), "/" before.
 */
export const SITE_HOME: string = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/` : "/";

/** The file route that renders the dashboard (what "/" is rewritten to on the app host). */
export const DASHBOARD_ROUTE = "/dashboard";

/** Host (with port) of a URL, lower case; null when missing or unparsable. */
export function hostOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Which side a request belongs to, from its Host header. */
export function hostModeFor(host: string | null | undefined, siteUrl: string | undefined): HostMode {
  const siteHost = hostOf(siteUrl);
  if (!siteHost) return "combined";
  const h = (host ?? "").toLowerCase();
  if (h === siteHost || h === `www.${siteHost}`) return "site";
  return "app";
}

/** Signed-out visitors may open these on the app side. */
const PUBLIC_APP_ROUTES = [
  "/login",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
  "/auth/sign-out",
  "/error",
  // Scheduled jobs: no session; the handler checks CRON_SECRET itself.
  "/api/cron",
];

function matches(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPublicRoute(pathname: string, mode: HostMode): boolean {
  // In combined mode "/" is the public homepage; on the app host it is the dashboard.
  if (mode === "combined" && pathname === "/") return true;
  return PUBLIC_APP_ROUTES.some((route) => matches(pathname, route));
}

/**
 * What the public site serves itself: the homepage (its inquiry form posts
 * back to "/"), API routes (the scheduled job), and Next.js internals.
 * Everything else belongs to the app and is redirected there.
 */
export function isSitePath(pathname: string): boolean {
  return pathname === "/" || matches(pathname, "/api") || pathname.startsWith("/_next") || pathname.startsWith("/__nextjs");
}

export type RouteDecision =
  | { kind: "next" }
  | { kind: "rewrite"; pathname: string }
  /** `location` is a path on the same host, or an absolute URL for another host. */
  | { kind: "redirect"; location: string; permanent: boolean };

export function decideRoute(input: {
  mode: HostMode;
  pathname: string;
  /** The query string including "?", or "". */
  search: string;
  /** Whether a session cookie is present. Null when auth is not configured (no auth redirects). */
  signedIn: boolean | null;
  /** The app's origin, for sending site visitors there. */
  appUrl: string;
}): RouteDecision {
  const { mode, pathname, search, signedIn, appUrl } = input;

  // The public site: the homepage only. Anything else moves to the app, query kept.
  if (mode === "site") {
    if (isSitePath(pathname)) return { kind: "next" };
    // Temporary (307), not permanent: browsers cache permanent redirects, which would make
    // switching the split off (or trying it locally) stick in visitors' browsers.
    return { kind: "redirect", location: `${appUrl.replace(/\/$/, "")}${pathname}${search}`, permanent: false };
  }

  const dashboard = mode === "app" ? "/" : DASHBOARD_ROUTE;

  // App host: one dashboard URL. Old /dashboard links (and saved notifications) land on "/".
  if (mode === "app" && pathname === DASHBOARD_ROUTE) {
    return { kind: "redirect", location: `/${search}`, permanent: false };
  }

  if (signedIn === false && !isPublicRoute(pathname, mode)) {
    // Keep where they were going, except the dashboard itself (the default after sign-in).
    const next = pathname === "/" || pathname === DASHBOARD_ROUTE ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return { kind: "redirect", location: `/login${next}`, permanent: false };
  }

  if (signedIn === true && pathname === "/login") {
    return { kind: "redirect", location: dashboard, permanent: false };
  }

  // The dashboard renders at the app's root without changing the address bar.
  if (mode === "app" && pathname === "/") return { kind: "rewrite", pathname: DASHBOARD_ROUTE };

  return { kind: "next" };
}
