import { describe, expect, it } from "vitest";
import { z } from "zod";

import { isUuid, parseQuery } from "@/lib/validation/url-params";

/** A hand-edited link never crashes a page (2026-11-18). */

describe("isUuid", () => {
  it("accepts only well-formed ids", () => {
    expect(isUuid("cb66eafd-5000-4267-8e79-92200bdae985")).toBe(true);
    expect(isUuid("cb66eafd-5000-4267-8e79-92200bdae985sd")).toBe(false);
    expect(isUuid("abc")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("parseQuery", () => {
  const schema = z.object({
    range: z.enum(["7d", "30d"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    q: z.string().optional(),
  });

  it("keeps good values", () => {
    expect(parseQuery(schema, { range: "7d", page: "3", q: "x" })).toEqual({ range: "7d", page: 3, q: "x" });
  });

  it("drops only the bad value instead of throwing", () => {
    expect(parseQuery(schema, { range: "abc", page: "2", q: "x" })).toEqual({ page: 2, q: "x" });
    expect(parseQuery(schema, { page: "x" })).toEqual({ page: 1 });
    expect(parseQuery(schema, { q: ["a", "b"] })).toEqual({ page: 1 });
  });
});
