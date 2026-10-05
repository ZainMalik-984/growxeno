/**
 * The only two currencies this business actually pays or spends in
 * (docs/REQUIREMENTS.md D1, confirmed directly 2026-09-17: revenue is
 * usually USD, worker cost/expenses usually PKR). The `currency` column
 * itself is deliberately unconstrained `CHAR(3)` — any ISO 4217 code fits —
 * but every currency picker in the UI offers only these two, so a typo
 * (`"UDS"`, `"usd "`) can no longer reach a stored row un-caught, and no
 * currency this business never uses shows up as a false choice. Pure — no
 * database — so importable from client components too.
 */
export const CURRENCIES = ["USD", "PKR"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/**
 * Rounding for CALCULATED money values (docs/REQUIREMENTS.md D2, answered
 * 2026-09-17: half-up to 2 decimal places). Applies only to a value produced
 * by a computation — a sum, a proportional split. A directly user-entered
 * amount is stored exactly as typed, never re-rounded.
 *
 * Pure — no database, no server-only import, same reasoning as
 * `src/lib/orders/state-machine.ts`.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Sums amounts keyed by currency, never blending different currencies into
 * one total (docs/REQUIREMENTS.md D1). `entries` are already-parsed numbers;
 * callers convert from `Decimal`/string at the query boundary.
 */
export function sumByCurrency(
  entries: Iterable<{ amount: number; currency: string }>,
  into: Record<string, number> = {},
): Record<string, number> {
  for (const entry of entries) {
    into[entry.currency] = roundMoney((into[entry.currency] ?? 0) + entry.amount);
  }
  return into;
}

/** "100.00 USD · 3500.00 PKR" — a per-currency breakdown, never a blended total. */
export function formatCurrencyBreakdown(byCurrency: Record<string, number>): string {
  const entries = Object.entries(byCurrency);
  if (entries.length === 0) return "—";
  return entries.map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`).join(" · ");
}
