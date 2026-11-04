/**
 * Computes what assigning an External Worker to an Order Item should cost,
 * from that worker's `ServiceRate` for the item's service — owner-directed,
 * confirmed directly (2026-10-05/2026-10-08), worked example: "subscriber
 * service by Zia charges are 3.5pkr for 1 subscriber... the cost would be
 * 500*3.5=1750."
 *
 * Pure — no database, no `server-only` — shared between the server
 * (`assignOrderItemWorker`, `src/lib/orders/service.ts`) and the client
 * (the assign control's cost preview, `order-items-panel.tsx`), and
 * unit-tested like `aggregateProgress` (`src/lib/orders/progress.ts`).
 */

export type RateInput = { rate: string; currency: string };

export type RatedItem = {
  /** Non-null means this is a metric item (views/subscribers/watch hours). */
  metricType: string | null;
  targetCount: number | null;
  startingCount: number | null;
};

export type ComputedCost = { cost: string; currency: string };

/**
 * A metric service is charged per unit × the REQUIRED count (target minus
 * starting — never charging for units the channel already had before any
 * work started, the same basis as `aggregateProgress`'s "actual work"
 * fix). A non-metric service is a flat rate: "it'll be flat rate." Returns
 * `null` when no rate is configured — never a reason to block assigning.
 */
export function computeAssignmentCost(item: RatedItem, rate: RateInput | null): ComputedCost | null {
  if (!rate) return null;
  const units = item.metricType ? Math.max(0, (item.targetCount ?? 0) - (item.startingCount ?? 0)) : 1;
  return { cost: (Number(rate.rate) * units).toFixed(2), currency: rate.currency };
}
