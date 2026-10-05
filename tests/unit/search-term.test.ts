import { describe, expect, it } from "vitest";

import { MAX_TERM_LENGTH, MIN_TERM_LENGTH, normalizeSearchTerm, PER_CATEGORY_LIMIT } from "@/lib/search/term";

describe("normalizeSearchTerm", () => {
  it("refuses a term too short to be worth a database lookup", () => {
    expect(normalizeSearchTerm("a")).toBeNull();
    expect(normalizeSearchTerm("  a  ")).toBeNull();
    expect(normalizeSearchTerm("ab")).toBe("ab");
    expect(MIN_TERM_LENGTH).toBe(2);
  });

  it("refuses an absurdly long term instead of sending it to the database", () => {
    expect(normalizeSearchTerm("x".repeat(MAX_TERM_LENGTH + 1))).toBeNull();
    expect(normalizeSearchTerm("x".repeat(MAX_TERM_LENGTH))).not.toBeNull();
  });

  it("collapses whitespace so equivalent searches share a cache entry", () => {
    expect(normalizeSearchTerm("  john   smith ")).toBe("john smith");
  });

  it("keeps results per category bounded", () => {
    expect(PER_CATEGORY_LIMIT).toBeLessThanOrEqual(10);
  });
});
