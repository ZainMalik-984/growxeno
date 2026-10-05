/**
 * URL normalization for Order Item links (specification Sections 133, 134;
 * docs/ORDERS.md §7).
 *
 * Pure and side-effect free — no network access, ever. The server must never
 * fetch a user-supplied URL.
 *
 * Rules:
 *   - Lower-case the scheme and host.
 *   - Drop a default port (`:80` for http, `:443` for https).
 *   - Drop exactly one trailing slash from the path (never the bare "/").
 *   - Preserve path CASE and the query string — both are frequently
 *     meaningful, and destroying them would break the search this exists for.
 *
 * Throws if `raw` is not a valid absolute http(s) URL. Only `http:` and `https:`
 * are accepted: a link is stored and later rendered as a clickable `href`, so
 * `javascript:`, `data:`, `vbscript:` etc. would be stored XSS — a worker who may
 * attach a link could run script as whichever admin clicked it (Phase 10 audit).
 */
export type NormalizedUrl = {
  normalizedUrl: string;
  domain: string;
  path: string;
};

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

/** The URL if it is a plain http(s) link, else null — for rendering a stored value as an `href` safely. */
export function safeExternalHref(raw: string): string | null {
  try {
    return ALLOWED_SCHEMES.has(new URL(raw.trim()).protocol.toLowerCase()) ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function normalizeUrl(raw: string): NormalizedUrl {
  const url = new URL(raw.trim());
  const scheme = url.protocol.toLowerCase();
  if (!ALLOWED_SCHEMES.has(scheme)) throw new Error("Only http and https links are allowed.");
  const host = url.hostname.toLowerCase();

  const isDefaultPort =
    (scheme === "http:" && url.port === "80") || (scheme === "https:" && url.port === "443");
  const authority = !isDefaultPort && url.port ? `${host}:${url.port}` : host;

  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return {
    normalizedUrl: `${scheme}//${authority}${pathname}${url.search}${url.hash}`,
    domain: host,
    path: pathname,
  };
}
