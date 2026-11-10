import { BadgePercent, Clock, Wallet } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/card";
import { MoneyTile } from "@/components/ui/metric";
import type { EmployeeCommission } from "@/lib/employees/queries";
import { formatCurrencyBreakdown } from "@/lib/finance/money";

/**
 * An employee's commission on the orders they created (owner request,
 * 2026-11-04). Only rendered when a commission percentage is set.
 */
export function CommissionCard({ commission, title = "Commission" }: { commission: EmployeeCommission; title?: string }) {
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={BadgePercent}
        tone="emerald"
        title={title}
        description={`${commission.percent}% of each order created · Fiverr orders after the ${commission.fiverrFeePercent}% fee`}
      />
      <div className="-mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
        <MoneyTile icon={Wallet} label="Earned" value={formatCurrencyBreakdown(commission.earnedByCurrency)} tone="emerald" />
        <MoneyTile icon={Clock} label="Pending" value={formatCurrencyBreakdown(commission.pendingByCurrency)} />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Earned counts delivered and finalized orders. Pending is open orders. Refunded or cancelled orders don&apos;t count.
      </p>
    </Card>
  );
}
