/**
 * Reads a service rate typed by a person (owner request, 2026-11-11: "should be
 * allowed to put decimal point values like .4, 25.23"). Accepts a whole number
 * or up to two decimals, with or without a leading zero (".4", "0.4", "25.23",
 * "25."), and returns it in a canonical form ("0.4", "25.23", "25") — or null
 * when it isn't a valid amount. Two decimals match the stored column. Pure.
 */
export function normalizeRate(input: string): string | null {
  const value = input.trim();
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(value);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (whole === "" && fraction === "") return null;
  const integer = whole.replace(/^0+(?=\d)/, "") || "0";
  return fraction ? `${integer}.${fraction}` : integer;
}
