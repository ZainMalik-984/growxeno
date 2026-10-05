import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { PageHeader, Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { resolveStatsRange, type RangePreset } from "@/lib/daily-stats/date-ranges";
import { formatCurrencyBreakdown } from "@/lib/finance/money";
import { getFinanceSummary, listRecognizedOrders } from "@/lib/finance/queries";
import { FinanceRangeBar } from "../finance-range-bar";

export const metadata: Metadata = { title: "Revenue" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

const searchParamsSchema = z.object({
  range: z.enum(["today", "7d", "30d", "90d", "custom"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

/** Recognized revenue for a range (specification Section 56) — on Delivered, per docs/REQUIREMENTS.md D4. */
export default async function RevenuePage({ searchParams }: PageProps<"/finance/revenue">) {
  await requirePermission("finance.revenue.view");
  const raw = await searchParams;
  const params = searchParamsSchema.parse(raw);
  const range = resolveStatsRange((params.range ?? "30d") as RangePreset, { from: params.from, to: params.to });

  const [summary, orders] = await Promise.all([getFinanceSummary(range), listRecognizedOrders(range)]);

  return (
    <>
      <PageHeader title="Revenue" description="Recognized on Delivered, excluding refunded orders." />
      <FinanceRangeBar />

      <Section title="Total for this range">
        <p className="text-[15px] text-ink">{formatCurrencyBreakdown(summary.revenueByCurrency)}</p>
        <p className="mt-1 text-[13px] text-ink-faint">{summary.recognizedOrderCount} order(s)</p>
      </Section>

      <Section title="Recognized orders">
        {orders.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No orders recognized in this range.</p>
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Recognized orders</caption>
              <THead>
                <TR>
                  <TH>Order</TH>
                  <TH>Customer</TH>
                  <TH>Delivered</TH>
                  <TH className="text-right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {orders.map((order) => (
                  <TR key={order.id}>
                    <TD>
                      <Link href={`/orders/${order.id}`} className="font-medium text-ink hover:underline">
                        #{order.orderNumber}
                      </Link>
                    </TD>
                    <TD className="text-ink-muted">{order.customerName ?? <span className="text-ink-faint">—</span>}</TD>
                    <TD className="text-ink-muted">{order.deliveredAt ? `${dateFormat.format(order.deliveredAt)} UTC` : <span className="text-ink-faint">—</span>}</TD>
                    <TD className="text-right text-ink-muted">
                      {order.totalAmount} {order.currency}
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
