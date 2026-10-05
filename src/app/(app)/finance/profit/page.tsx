import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { PageHeader, Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { resolveStatsRange, type RangePreset } from "@/lib/daily-stats/date-ranges";
import { listOrderProfitRows } from "@/lib/finance/queries";
import { FinanceRangeBar } from "../finance-range-bar";

export const metadata: Metadata = { title: "Profit" };

const searchParamsSchema = z.object({
  range: z.enum(["today", "7d", "30d", "90d", "custom"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

/**
 * Per-order profit (specification Section 56: Selling Amount - Worker Cost -
 * Other Cost). A dash in the Profit column means worker cost/expenses were
 * in a different currency than revenue — shown separately rather than
 * blended (docs/REQUIREMENTS.md D1).
 */
export default async function ProfitPage({ searchParams }: PageProps<"/finance/profit">) {
  await requirePermission("finance.profit.view");
  const raw = await searchParams;
  const params = searchParamsSchema.parse(raw);
  const range = resolveStatsRange((params.range ?? "30d") as RangePreset, { from: params.from, to: params.to });

  const rows = await listOrderProfitRows(range);

  return (
    <>
      <PageHeader title="Profit" description="Selling amount minus worker cost minus other expenses, per order." />
      <FinanceRangeBar />

      <Section title="Recognized orders">
        {rows.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No orders recognized in this range.</p>
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Order profit</caption>
              <THead>
                <TR>
                  <TH>Order</TH>
                  <TH className="text-right">Revenue</TH>
                  <TH className="text-right">Worker cost</TH>
                  <TH className="text-right">Expenses</TH>
                  <TH className="text-right">Profit</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link href={`/orders/${row.id}`} className="font-medium text-ink hover:underline">
                        #{row.orderNumber}
                      </Link>
                    </TD>
                    <TD className="text-right text-ink-muted">
                      {row.revenue} {row.currency}
                    </TD>
                    <TD className="text-right text-ink-muted">{row.workerCost > 0 ? `${row.workerCost.toFixed(2)} ${row.currency}` : <span className="text-ink-faint">—</span>}</TD>
                    <TD className="text-right text-ink-muted">{row.expenses > 0 ? `${row.expenses.toFixed(2)} ${row.currency}` : <span className="text-ink-faint">—</span>}</TD>
                    <TD className="text-right text-ink">
                      {row.profit !== null ? (
                        `${row.profit.toFixed(2)} ${row.currency}`
                      ) : (
                        <span className="text-ink-faint" title="Worker cost or expenses were in a different currency than revenue">
                          see order
                        </span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
