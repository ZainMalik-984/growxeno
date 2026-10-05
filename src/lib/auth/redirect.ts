/**
 * Post-login redirect targets (`?next=`) must stay on this site.
 *
 * The naive check `startsWith("/") && !startsWith("//")` is bypassable: a browser
 * (and `new URL(path, base)`) treats a backslash as a slash, so `/\evil.com`
 * becomes `//evil.com` and leaves the site. Instead the value is parsed against
 * a throwaway origin and accepted only if it still resolves to that same
 * origin. Pure — no `server-only`, so it is unit-tested.
 */
const PLACEHOLDER_ORIGIN = "http://internal.invalid";

function hasBackslashOrControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    // Backslash, and ASCII control characters (a tab or newline is silently stripped by URL
    // parsers, which can turn "/<tab>/evil.com" into "//evil.com").
    if (char === "\\" || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function safeRedirectPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (hasBackslashOrControlCharacter(next)) return fallback;
  if (next.startsWith("//")) return fallback;

  try {
    const url = new URL(next, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
