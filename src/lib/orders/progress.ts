/**
 * Aggregate progress across an order's metric-tracked items (confirmed
 * directly, 2026-10-05): "each row for order should have progress bar and
 * percentage which would show the aggregate percentage of all order items."
 *
 * Measures ACTUAL WORK DONE, not the count the item already had at creation
 * (confirmed directly, 2026-10-05, after an earlier version of this got it
 * wrong): "the progress on orders page should not consider the count of
 * item at the time of the order it should show the actual work progress."
 * Worked example: a video sits at 1000 views, the customer wants 5000
 * more, so `startingCount` = 1000 and `targetCount` = 6000. Sitting at
 * 1000 (no work done yet) must read as 0%, not ~17% (1000/6000) — only
 * once `currentCount` moves past the 1000 baseline does the bar move.
 *
 * Pure — no database, no `server-only` — so it is unit-tested. Called from
 * the orders-list page AFTER `redactOrderListItems`, so a restricted
 * Worker's bar always matches the breakdown they can actually see; an actor
 * with `orders.view.all` gets the order's true, full aggregate.
 */

export type ProgressItemInput = {
  targetCount: number | null;
  currentCount: number | null;
  /**
   * Snapshotted once at item creation (never updated afterward — see the
   * schema doc comment on `OrderItem.startingCount`). `null` for an item
   * created before this column existed; treated as 0, which reproduces the
   * old current/target behaviour for those legacy rows rather than refusing
   * to show them a bar.
   */
  startingCount: number | null;
};

export type AggregateProgress = {
  current: number;
  target: number;
  percent: number;
};

/**
 * Only items with a positive target participate — a non-metric item (no
 * views/subscribers/watch-hours to track) has nothing to add to either side
 * of the ratio. For each item, "required" is `targetCount - startingCount`
 * (how many more were actually asked for) and "done" is `currentCount -
 * startingCount` (how much has actually been delivered since), each clamped
 * to `[0, required]` so neither a stale/lower `currentCount` nor an
 * over-delivered one can push an individual item below 0% or past 100%. An
 * item whose required amount is 0 (nothing asked for beyond the starting
 * point) contributes nothing to either side — there is no work to measure.
 *
 * Returns `null` when the order has no metric items with real work to
 * track (nothing to show a bar for).
 */
export function aggregateProgress(items: readonly ProgressItemInput[]): AggregateProgress | null {
  let current = 0;
  let target = 0;

  for (const item of items) {
    if (item.targetCount == null || item.targetCount <= 0) continue;
    const baseline = Math.max(0, item.startingCount ?? 0);
    const required = Math.max(0, item.targetCount - baseline);
    if (required === 0) continue;

    const done = Math.min(Math.max((item.currentCount ?? 0) - baseline, 0), required);
    current += done;
    target += required;
  }

  if (target === 0) return null;

  const percent = Math.round((100 * current) / target);
  return { current, target, percent };
}
