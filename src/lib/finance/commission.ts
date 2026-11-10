import type { OrderSource, OrderStatus } from "@/generated/prisma/client";

/**
 * Employee commission (owner request, 2026-11-04): an employee may earn a
 * percentage of the orders they create.
 *
 *   commission = employee % × (order price − Fiverr fee)   for a Fiverr order
 *   commission = employee % × order price                  for an External order
 *
 * Owner's choices, confirmed directly the same day: the Fiverr fee (Settings)
 * comes off Fiverr orders only; an order counts as EARNED once Delivered or
 * Finalized (the same point revenue is recognized), open orders show as
 * PENDING, and Refunded / Cancelled orders never count. Amounts stay per
 * currency, never blended (D1).
 *
 * Pure, so it is unit-tested (tests/unit/commission.test.ts).
 */

export type CommissionOrder = {
  source: OrderSource;
  status: OrderStatus;
  currency: string;
  /** Order price, as a decimal string or number. */
  totalAmount: string | number;
};

export type CommissionTotals = {
  earnedByCurrency: Record<string, number>;
  pendingByCurrency: Record<string, number>;
};

const EARNED: readonly OrderStatus[] = ["DELIVERED", "FINALIZED"];

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Commission on one order's price. */
export function commissionOnOrder(order: Pick<CommissionOrder, "source" | "totalAmount">, commissionPercent: number, fiverrFeePercent: number): number {
  const price = Number(order.totalAmount);
  if (!Number.isFinite(price) || price <= 0 || commissionPercent <= 0) return 0;
  const base = order.source === "FIVERR" ? price * (1 - fiverrFeePercent / 100) : price;
  return round2(base * (commissionPercent / 100));
}

export function commissionTotals(
  orders: readonly CommissionOrder[],
  commissionPercent: number,
  fiverrFeePercent: number,
): CommissionTotals {
  const earnedByCurrency: Record<string, number> = {};
  const pendingByCurrency: Record<string, number> = {};
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    const amount = commissionOnOrder(order, commissionPercent, fiverrFeePercent);
    if (amount === 0) continue;
    const bucket = EARNED.includes(order.status) ? earnedByCurrency : pendingByCurrency;
    bucket[order.currency] = round2((bucket[order.currency] ?? 0) + amount);
  }
  return { earnedByCurrency, pendingByCurrency };
}
