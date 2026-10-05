import { EmptyState } from "@/components/ui/page";
import { formatCurrencyBreakdown } from "@/lib/finance/money";
import type { CurrencyMap } from "@/lib/reports/queries";
import { MAX_RANGE_DAYS } from "@/lib/reports/range";

export { FinanceRangeBar as ReportRangeBar } from "../finance/finance-range-bar";

export const money = (map: CurrencyMap | null | undefined) => (map ? formatCurrencyBreakdown(map) : "—");

export function ClampNotice({ clamped }: { clamped: boolean }) {
  if (!clamped) return null;
  return (
    <p className="mb-4 text-[13px] text-amber-700">
      That range is wider than {MAX_RANGE_DAYS} days, so this shows the most recent {MAX_RANGE_DAYS}. Wide reports are capped to keep them fast.
    </p>
  );
}

export function NoData({ what }: { what: string }) {
  return <EmptyState title={`No ${what} in this range`} description="Try a wider date range." />;
}

/** A proportional bar, no chart library: width relative to the largest value in its own currency. */
export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div aria-hidden="true" className="h-1.5 w-full max-w-40 bg-canvas-subtle">
      <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}
