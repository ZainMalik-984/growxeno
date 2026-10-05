import type { Metadata } from "next";
import Link from "next/link";

import { MetaList, PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { resolveReportRange } from "@/lib/reports/params";
import { getMoneyMovementTotals } from "@/lib/reports/queries";
import { ClampNotice, money, ReportRangeBar } from "./report-parts";

export const metadata: Metadata = { title: "Reports" };

const LINKS = [
  { href: "/reports/sales", label: "Sales", permissions: ["reports.sales", "finance.revenue.view"] },
  { href: "/reports/orders", label: "Orders", permissions: ["reports.orders"] },
  { href: "/reports/workers", label: "Workers", permissions: ["reports.workers"] },
  { href: "/reports/customers", label: "Customers", permissions: ["reports.customers"] },
  { href: "/reports/profit", label: "Profit", permissions: ["reports.profit", "finance.profit.view"] },
];

/**
 * Reports overview (specification Section 75). Sales, Orders, Workers,
 * Customers and Profit are reports of their own; Expenses, Worker payments
 * and Daily statistics already have full list pages elsewhere, so they
 * appear here as totals for the range with a link, not a duplicate.
 */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const actor = await requirePermission("reports.view");
  const { range, clamped } = resolveReportRange(await searchParams);

  const canExpenses = actor.permissions.has("finance.expenses.view");
  const canWorkerPayments = actor.permissions.has("finance.worker_payments.view");
  const totals = canExpenses || canWorkerPayments ? await getMoneyMovementTotals(range) : null;

  return (
    <>
      <PageHeader title="Reports" description="Every report takes a date range and is capped so it stays fast." />
      <ReportRangeBar />
      <ClampNotice clamped={clamped} />

      <Section title="Reports">
        <div className="flex flex-wrap gap-4 text-[13px]">
          {LINKS.filter((l) => l.permissions.every((p) => actor.permissions.has(p))).map((l) => (
            <Link key={l.href} href={l.href} className="text-ink hover:underline">
              {l.label}
            </Link>
          ))}
        </div>
      </Section>

      {totals ? (
        <Section title="Money moved in this range" description="Full lists live under Finance and Daily Statistics.">
          <MetaList
            items={[
              ...(canExpenses ? [{ label: "Expenses", value: <><span>{money(totals.expenses)}</span> · <Link href="/finance/expenses" className="text-ink-muted hover:underline">list</Link></> }] : []),
              ...(canWorkerPayments ? [{ label: "Worker payments", value: <><span>{money(totals.workerPayments)}</span> · <Link href="/finance/worker-payments" className="text-ink-muted hover:underline">list</Link></> }] : []),
            ]}
          />
        </Section>
      ) : null}

      {actor.permissions.has("daily_stats.view") ? (
        <Section title="Daily statistics">
          <Link href="/daily-stats" className="text-[13px] text-ink hover:underline">
            Open Daily Statistics
          </Link>
        </Section>
      ) : null}
    </>
  );
}
