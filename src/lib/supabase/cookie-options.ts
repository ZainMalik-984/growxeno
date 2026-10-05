/**
 * Hardened options for the Supabase auth (session) cookies.
 *
 * The library's defaults leave the session cookie readable by page JavaScript,
 * because its browser client needs that. This application never uses the browser
 * client — every auth call happens on the server — so there is no reason for
 * script to read the session token, and making it unreadable means a
 * cross-site-scripting bug could not be used to steal a login.
 *
 *  - httpOnly  page scripts cannot read it
 *  - sameSite  "lax": not sent on cross-site sub-requests or forms (CSRF), but
 *              still sent when someone follows a link to the app
 *  - secure    HTTPS only, in production (a localhost dev server is plain http)
 *
 * Pure, so it is unit-tested. Applied in both places that write the cookie: the
 * server client and the request proxy.
 */
export type CookieOptions = {
  path?: string;
  maxAge?: number;
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
};

export function hardenAuthCookieOptions(options: CookieOptions | undefined, isProduction: boolean): CookieOptions {
  return { ...options, httpOnly: true, sameSite: "lax", secure: isProduction };
}
