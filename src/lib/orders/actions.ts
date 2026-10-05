"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import {
  addOrderItem,
  addOrderItemLink,
  addOrderNote,
  assignOrderItemWorker,
  cancelOrderItemWithAdjustedCost,
  changeOrderItemStatus,
  changeOrderStatus,
  createOrder,
  processOrder,
  removeOrderItem,
  removeOrderItemLink,
  updateOrder,
  updateOrderItem,
} from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");
const moneyString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount.");
// Owner-directed simplification (confirmed directly, 2026-09-27: "currently
// there are only two sources for order Fiverr and External"), replacing the
// original generic four-value enum.
const orderSourceSchema = z.enum(["FIVERR", "EXTERNAL"]);

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

const orderInputSchema = z.object({
  source: orderSourceSchema,
  externalReference: z.string().trim().max(160).optional(),
  customerId: uuid.nullable().optional(),
  // Required by the service layer when source === "FIVERR" (confirmed
  // directly, 2026-09-27: "fiverr account should be taken if source is
  // Fiverr"); ignored, and forced to null, for an EXTERNAL order.
  fiverrAccountId: uuid.nullable().optional(),
  deadline: z.string().nullable().optional(),
  notes: z.string().trim().max(4000).optional(),
  currency: z.string().trim().length(3).optional(),
  // The whole order's price (owner-directed redesign, confirmed directly
  // 2026-09-27) — optional, same looseness as the deadline before Process Order.
  totalAmount: z.union([moneyString, z.literal("")]).optional(),
});

export type CreateOrderActionResult =
  | { ok: true; message: string; orderId: string }
  | { ok: false; error: string };

export async function createOrderAction(input: unknown): Promise<CreateOrderActionResult> {
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("orders.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createOrder(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/orders");
  return { ok: true, message: "Order created.", orderId: result.data.id };
}

const orderIdSchema = z.object({ orderId: uuid });

export async function updateOrderAction(input: unknown): Promise<ActionResult> {
  const parsed = orderIdSchema.extend(orderInputSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("orders.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateOrder(auth.actor, parsed.data.orderId, parsed.data);
  if (result.ok) {
    revalidatePath(`/orders/${parsed.data.orderId}`);
    revalidatePath("/orders");
  }
  return result.ok ? { ok: true, message: "Order updated." } : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Order status
// ---------------------------------------------------------------------------

const changeStatusSchema = z.object({
  orderId: uuid,
  status: z.enum([
    "PENDING",
    "PROCESSING",
    "IN_PROGRESS",
    "INTERNAL_REVIEW",
    "READY_FOR_DELIVERY",
    "DELIVERED",
    "COMPLETED",
    "REVISION",
    "CANCELLED",
  ]),
  reason: z.string().trim().max(1000).optional(),
});

export async function changeOrderStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("orders.change_status");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await changeOrderStatus(auth.actor, parsed.data.orderId, parsed.data.status, parsed.data.reason);
  if (result.ok) {
    revalidatePath(`/orders/${parsed.data.orderId}`);
    revalidatePath("/orders");
  }
  return result.ok ? { ok: true, message: "Status updated." } : { ok: false, error: result.error };
}

export async function processOrderAction(input: unknown): Promise<ActionResult> {
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("orders.process");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await processOrder(auth.actor, parsed.data.orderId);
  if (result.ok) {
    revalidatePath(`/orders/${parsed.data.orderId}`);
    revalidatePath("/orders");
  }
  return result.ok ? { ok: true, message: "Order processed." } : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Order items
// ---------------------------------------------------------------------------

const orderItemInputSchema = z.object({
  serviceId: uuid,
  description: z.string().trim().max(4000).optional(),
  deadline: z.string().nullable().optional(),
  // Only meaningful when the chosen service has a metric type — the service
  // layer enforces that requirement (it alone knows the service's metricType),
  // so these are just format checks here, not requiredness.
  channelLink: z.union([z.url("Enter a valid URL, including https://."), z.literal("")]).optional(),
  targetCount: z.coerce.number().int().min(0, "Cannot be negative.").optional(),
  currentCount: z.coerce.number().int().min(0, "Cannot be negative.").optional(),
  workerCost: z.union([moneyString, z.literal("")]).optional(),
  workerCostCurrency: z.string().trim().length(3).optional(),
});

export type AddOrderItemActionResult =
  | { ok: true; message: string; itemId: string }
  | { ok: false; error: string };

export async function addOrderItemAction(input: unknown): Promise<AddOrderItemActionResult> {
  const parsed = orderIdSchema.extend(orderItemInputSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("orders.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await addOrderItem(auth.actor, parsed.data.orderId, {
    ...parsed.data,
    channelLink: parsed.data.channelLink || null,
    targetCount: parsed.data.targetCount ?? null,
    currentCount: parsed.data.currentCount ?? null,
    workerCost: parsed.data.workerCost || null,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orders/${parsed.data.orderId}`);
  return { ok: true, message: "Item added.", itemId: result.data.id };
}

const itemIdSchema = z.object({ itemId: uuid });

export async function updateOrderItemAction(input: unknown): Promise<ActionResult> {
  const parsed = itemIdSchema.extend(orderItemInputSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("orders.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateOrderItem(auth.actor, parsed.data.itemId, {
    ...parsed.data,
    channelLink: parsed.data.channelLink || null,
    targetCount: parsed.data.targetCount ?? null,
    currentCount: parsed.data.currentCount ?? null,
    workerCost: parsed.data.workerCost || null,
  });
  return result.ok ? { ok: true, message: "Item updated." } : { ok: false, error: result.error };
}

export async function removeOrderItemAction(input: unknown): Promise<ActionResult> {
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("orders.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await removeOrderItem(auth.actor, parsed.data.itemId);
  return result.ok ? { ok: true, message: "Item removed." } : { ok: false, error: result.error };
}

const assignWorkerSchema = z.object({
  itemId: uuid,
  workerId: uuid.nullable().optional(),
  outsourcedWorkerId: uuid.nullable().optional(),
});

export async function assignOrderItemWorkerAction(input: unknown): Promise<ActionResult> {
  const parsed = assignWorkerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("orders.assign");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await assignOrderItemWorker(auth.actor, parsed.data.itemId, parsed.data);
  return result.ok ? { ok: true, message: "Assignment updated." } : { ok: false, error: result.error };
}

const changeItemStatusSchema = z.object({
  itemId: uuid,
  status: z.enum(["PENDING", "IN_PROGRESS", "INTERNAL_REVIEW", "REVISION", "COMPLETED", "CANCELLED"]),
});

export async function changeOrderItemStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = changeItemStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("orders.change_status");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await changeOrderItemStatus(auth.actor, parsed.data.itemId, parsed.data.status);
  return result.ok ? { ok: true, message: "Item status updated." } : { ok: false, error: result.error };
}

const cancelWithAdjustedCostSchema = z.object({
  itemId: uuid,
  adjustedWorkerCost: z.union([moneyString, z.literal("")]).optional(),
  note: z.string().trim().min(1, "Explain why this item is being cancelled."),
});

export async function cancelOrderItemWithAdjustedCostAction(input: unknown): Promise<ActionResult> {
  const parsed = cancelWithAdjustedCostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("orders.change_status");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await cancelOrderItemWithAdjustedCost(auth.actor, parsed.data.itemId, {
    adjustedWorkerCost: parsed.data.adjustedWorkerCost || undefined,
    note: parsed.data.note,
  });
  return result.ok ? { ok: true, message: "Item cancelled." } : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Order Item links
// ---------------------------------------------------------------------------

const addLinkSchema = z.object({
  itemId: uuid,
  url: z.url("Enter a valid URL, including https://."),
  label: z.string().trim().max(80).optional(),
});

export async function addOrderItemLinkAction(input: unknown): Promise<ActionResult> {
  const parsed = addLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  // Two ways in: `orders.edit` (an editor, any item) or `orders.files.upload`
  // (a worker attaching their own deliverable link — the service layer below
  // restricts the latter to items the actor is actually assigned to).
  const editAuth = await authorizeAction("orders.edit");
  const auth = editAuth.ok ? editAuth : await authorizeAction("orders.files.upload");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await addOrderItemLink(auth.actor, parsed.data.itemId, parsed.data);
  return result.ok ? { ok: true, message: "Link added." } : { ok: false, error: result.error };
}

const linkIdSchema = z.object({ linkId: uuid });

export async function removeOrderItemLinkAction(input: unknown): Promise<ActionResult> {
  const parsed = linkIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("orders.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await removeOrderItemLink(auth.actor, parsed.data.linkId);
  return result.ok ? { ok: true, message: "Link removed." } : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Order notes
// ---------------------------------------------------------------------------

const addNoteSchema = z.object({ orderId: uuid, body: z.string().trim().min(1, "Write a note first.").max(4000) });

export async function addOrderNoteAction(input: unknown): Promise<ActionResult> {
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("orders.comment");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await addOrderNote(auth.actor, parsed.data.orderId, parsed.data.body);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orders/${parsed.data.orderId}`);
  return { ok: true, message: "Note added." };
}

