import { z } from "zod";

/**
 * Reading ids and query strings from the address safely (2026-11-18).
 *
 * A hand-edited or truncated link ("/customers/cb66…985sd", "?range=abc",
 * "?page=x") must never crash a page with a 500. An id that isn't a UUID can't
 * name any record, so it is "not found"; a query value that doesn't fit is
 * ignored, as if it weren't there. Pure, so it is unit-tested.
 */

const UUID = z.uuid();

/** True for a well-formed UUID: the only shape a record id in the app takes. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.safeParse(value).success;
}

/**
 * Parse a page's query string, dropping any value that doesn't fit the schema
 * instead of throwing. If the values only fail together (a cross-field rule),
 * falls back to the schema's defaults.
 */
export function parseQuery<S extends z.ZodType>(schema: S, raw: Record<string, unknown>): z.output<S> {
  const first = schema.safeParse(raw);
  if (first.success) return first.data;

  const bad = new Set(first.error.issues.map((issue) => String(issue.path[0] ?? "")));
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([key]) => !bad.has(key)));
  const second = schema.safeParse(cleaned);
  if (second.success) return second.data;

  return schema.parse({});
}
