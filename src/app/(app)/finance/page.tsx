import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { MetaList, PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { resolveStatsRange, type RangePreset } from "@/lib/daily-stats/date-ranges";
import { formatCurrencyBreakdown } from "@/lib/finance/money";
import { getFinanceSummary } from "@/lib/finance/queries";
import { FinanceRangeBar } from "./finance-range-bar";

export const metadata: Metadata = { title: "Finance" };

const searchParamsSchema = z.object({
  range: z.enum(["today", "7d", "30d", "90d", "custom"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

/**
 * Finance Overview (specification Section 56).
 *
 * Revenue / Worker Cost / Expenses / Profit are shown as SEPARATE figures per
 * currency, never blended into one number when currencies differ (confirmed
 * directly 2026-09-17: revenue is usually USD, worker cost/expenses PKR) —
 * see `src/lib/finance/queries.ts`'s header comment.
 */
export default async function FinanceOverviewPage({ searchParams }: PageProps<"/finance">) {
  const actor = await requirePermission("finance.view");
  const raw = await searchParams;
  const params = searchParamsSchema.parse(raw);
  // Default to 30 days here (unlike Daily Statistics' 7-day default) — a
  // monthly view is the more natural first look for revenue/profit.
  const range = resolveStatsRange((params.range ?? "30d") as RangePreset, { from: params.from, to: params.to });

  const canViewRevenue = actor.permissions.has("finance.revenue.view");
  const canViewProfit = actor.permissions.has("finance.profit.view");
  const canViewExpenses = actor.permissions.has("finance.expenses.view");
  const canViewWorkerPayments = actor.permissions.has("finance.worker_payments.view");

  const summary = await getFinanceSummary(range);

  return (
    <>
      <PageHeader
        title="Finance"
        description="Revenue on delivery, worker cost from outsourced items, expenses, and profit — each shown per currency, never blended."
      />

      <FinanceRangeBar />

      <Section title="This range">
        <MetaList
          items={[
            { label: "Recognized orders", value: summary.recognizedOrderCount },
            ...(canViewRevenue ? [{ label: "Revenue", value: formatCurrencyBreakdown(summary.revenueByCurrency) }] : []),
            { label: "Worker cost (outsourced)", value: formatCurrencyBreakdown(summary.workerCostByCurrency) },
            ...(canViewExpenses ? [{ label: "Expenses", value: formatCurrencyBreakdown(summary.expensesByCurrency) }] : []),
            ...(canViewProfit ? [{ label: "Profit", value: formatCurrencyBreakdown(summary.profitByCurrency) }] : []),
          ]}
        />
      </Section>

      <Section title="Go to">
        <div className="flex flex-wrap gap-4 text-[13px]">
          {canViewExpenses ? (
            <Link href="/finance/expenses" className="text-ink hover:underline">
              Expenses
            </Link>
          ) : null}
          {canViewWorkerPayments ? (
            <Link href="/finance/worker-payments" className="text-ink hover:underline">
              Worker Payments
            </Link>
          ) : null}
          {canViewRevenue ? (
            <Link href="/finance/revenue" className="text-ink hover:underline">
              Revenue
            </Link>
          ) : null}
          {canViewProfit ? (
            <Link href="/finance/profit" className="text-ink hover:underline">
              Profit
            </Link>
          ) : null}
        </div>
      </Section>
    </>
  );
}
