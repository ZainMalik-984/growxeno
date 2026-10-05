import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/auth/redirect";

const fallback = "/dashboard";

describe("safeRedirectPath", () => {
  it("keeps a normal in-site path, query and hash", () => {
    expect(safeRedirectPath("/orders?status=PENDING#top", fallback)).toBe("/orders?status=PENDING#top");
    expect(safeRedirectPath("/orders/abc", fallback)).toBe("/orders/abc");
  });

  it("falls back when there is no target", () => {
    expect(safeRedirectPath(null, fallback)).toBe(fallback);
    expect(safeRedirectPath(undefined, fallback)).toBe(fallback);
    expect(safeRedirectPath("", fallback)).toBe(fallback);
  });

  it.each([
    ["absolute URL", "https://evil.com/x"],
    ["protocol-relative", "//evil.com"],
    ["backslash bypass", "/" + String.fromCharCode(92) + "evil.com"],
    ["double backslash", "/" + String.fromCharCode(92, 92) + "evil.com"],
    ["tab hiding a slash", "/" + String.fromCharCode(9) + "/evil.com"],
    ["newline hiding a slash", "/" + String.fromCharCode(10) + "/evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["no leading slash", "evil.com"],
  ])("rejects %s", (_name, value) => {
    expect(safeRedirectPath(value, fallback)).toBe(fallback);
  });
});
