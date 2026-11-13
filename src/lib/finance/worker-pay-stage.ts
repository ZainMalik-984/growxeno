import type { OrderItemStatus } from "@/generated/prisma/client";

/**
 * Where an item's pay stands for the worker (owner's rule, 2026-11-12):
 *
 * - earned: the worker marked it done and the team accepted the delivery,
 *   or the team closed it with pay (cancelled with an adjusted cost). Only
 *   this counts toward the available balance.
 * - awaiting: marked done by the worker; nobody on the team has accepted it yet.
 * - inProgress: not marked done yet (assigned, being worked on, or a refill).
 */
export type WorkerPayStage = "earned" | "awaiting" | "inProgress";

export function workerPayStage(itemStatus: OrderItemStatus, deliveryAccepted: boolean): WorkerPayStage {
  if (itemStatus === "CANCELLED") return "earned";
  if (itemStatus === "DONE") return deliveryAccepted ? "earned" : "awaiting";
  return "inProgress";
}
