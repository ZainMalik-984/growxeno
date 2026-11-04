import type { OrderItemStatus, OrderStatus } from "@/generated/prisma/client";
import type { StatusTone } from "@/components/ui/status-dot";

/**
 * One colour per status, shared by the order page, the orders list, the board
 * and the dashboard so a status always looks the same (2026-11-03 rework).
 */
export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  PENDING: "active",
  ASSIGNED: "ready",
  PROCESSING: "progress",
  PARTIALLY_COMPLETED: "review",
  COMPLETED: "done",
  DELIVERED: "done",
  FINALIZED: "neutral",
  CANCELLED: "danger",
};

export const ITEM_STATUS_TONE: Record<OrderItemStatus, StatusTone> = {
  PENDING: "active",
  PROCESSING: "progress",
  DONE: "done",
  REFILL: "warning",
  CANCELLED: "neutral",
};
