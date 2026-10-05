import { describe, expect, it } from "vitest";

import { hardenAuthCookieOptions } from "@/lib/supabase/cookie-options";

describe("hardenAuthCookieOptions", () => {
  it("makes the session cookie unreadable by page scripts and not sent cross-site", () => {
    const options = hardenAuthCookieOptions({ path: "/", maxAge: 3600, httpOnly: false, sameSite: "none" }, true);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 3600 });
  });

  it("only requires HTTPS in production, so a localhost dev server can still sign in", () => {
    expect(hardenAuthCookieOptions({}, false).secure).toBe(false);
    expect(hardenAuthCookieOptions(undefined, true).secure).toBe(true);
  });
});
