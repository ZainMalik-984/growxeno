import { describe, expect, it } from "vitest";

import { normalizeUrl, safeExternalHref } from "@/lib/orders/url-normalize";

describe("normalizeUrl", () => {
  it("lower-cases the scheme and host", () => {
    expect(normalizeUrl("HTTPS://Example.COM/Path").normalizedUrl).toBe("https://example.com/Path");
  });

  it("drops a default port", () => {
    expect(normalizeUrl("https://example.com:443/x").normalizedUrl).toBe("https://example.com/x");
    expect(normalizeUrl("http://example.com:80/x").normalizedUrl).toBe("http://example.com/x");
  });

  it("keeps a non-default port", () => {
    expect(normalizeUrl("https://example.com:8443/x").normalizedUrl).toBe(
      "https://example.com:8443/x",
    );
  });

  it("drops exactly one trailing slash, but never the bare root", () => {
    expect(normalizeUrl("https://example.com/project/").normalizedUrl).toBe(
      "https://example.com/project",
    );
    expect(normalizeUrl("https://example.com/").normalizedUrl).toBe("https://example.com/");
  });

  it("preserves path case", () => {
    expect(normalizeUrl("https://example.com/Project/Client-A").normalizedUrl).toBe(
      "https://example.com/Project/Client-A",
    );
  });

  it("preserves the query string verbatim", () => {
    expect(normalizeUrl("https://example.com/x?ref=Abc&id=1").normalizedUrl).toBe(
      "https://example.com/x?ref=Abc&id=1",
    );
  });

  it("returns the lower-cased hostname as domain, and the normalized path", () => {
    const result = normalizeUrl("HTTPS://Example.COM/Project/");
    expect(result.domain).toBe("example.com");
    expect(result.path).toBe("/Project");
  });

  it("throws on an invalid URL", () => {
    expect(() => normalizeUrl("not a url")).toThrow();
  });
});

describe("link scheme safety (stored XSS)", () => {
  const dangerous = [
    "javascript:alert(document.cookie)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/x",
  ];

  it.each(dangerous)("normalizeUrl refuses %s", (value) => {
    expect(() => normalizeUrl(value)).toThrow();
  });

  it.each(dangerous)("safeExternalHref returns null for %s, so it can never become an href", (value) => {
    expect(safeExternalHref(value)).toBeNull();
  });

  it("still accepts and passes through ordinary http(s) links", () => {
    expect(() => normalizeUrl("http://example.com/a")).not.toThrow();
    expect(() => normalizeUrl("https://example.com/a?b=1#c")).not.toThrow();
    expect(safeExternalHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeExternalHref("  https://example.com/a  ")).toBe("https://example.com/a");
  });
});
