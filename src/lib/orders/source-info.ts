import type { OrderVisibility } from "./visibility";

/**
 * Where an order came from, as the orders lists show it (owner request,
 * 2026-11-15): the Fiverr profile it landed on, or an External order's
 * details. Admins and employees only. Pure, so it is unit-tested.
 */
export type OrderSourceInfo =
  | { kind: "FIVERR"; profileName: string | null; reference: string | null }
  | {
      kind: "EXTERNAL";
      reference: string | null;
      orderDate: Date | null;
      notes: string | null;
      customer: { name: string; email: string | null; phone: string | null } | null;
    };

export type OrderSourceFields = {
  source: "FIVERR" | "EXTERNAL";
  fiverrProfileName: string | null;
  externalReference: string | null;
  orderDate: Date | null;
  notes: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

/**
 * Null unless the actor sees both the order's own details and its parties,
 * so the source never reaches a worker's page payload (the same server-side
 * rule as src/lib/orders/visibility.ts).
 */
export function orderSourceInfo(order: OrderSourceFields, visibility: Pick<OrderVisibility, "orderDetails" | "parties">): OrderSourceInfo | null {
  if (!visibility.orderDetails || !visibility.parties) return null;
  if (order.source === "FIVERR") {
    return { kind: "FIVERR", profileName: order.fiverrProfileName, reference: order.externalReference };
  }
  return {
    kind: "EXTERNAL",
    reference: order.externalReference,
    orderDate: order.orderDate,
    notes: order.notes,
    customer: order.customerName ? { name: order.customerName, email: order.customerEmail, phone: order.customerPhone } : null,
  };
}
