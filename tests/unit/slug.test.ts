import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/text/slug";

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(slugify("Senior Worker")).toBe("senior-worker");
  });

  it("strips punctuation", () => {
    expect(slugify("Reviewer (Level 2)!")).toBe("reviewer-level-2");
  });

  it("collapses repeated separators and trims leading/trailing hyphens", () => {
    expect(slugify("  --Ops   & Finance--  ")).toBe("ops-finance");
  });

  it("removes diacritics", () => {
    expect(slugify("Café Manager")).toBe("cafe-manager");
  });

  it("truncates to 80 characters", () => {
    const long = "a".repeat(200);
    expect(slugify(long)).toHaveLength(80);
  });

  it("returns an empty string for input with no slug-able characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});
