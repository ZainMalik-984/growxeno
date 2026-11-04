"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import { canChangeWholeOrderStatus } from "./visibility";
import {
  addOrderItem,
  addOrderItemLink,
  addOrderNote,
  assignOrderItemWorker,
  cancelOrderItemWithAdjustedCost,
  changeOrderItemStatus,
  changeOrderStatus,
  createOrder,
  removeOrderItem,
  removeOrderItemLink,
  updateOrder,
  setOrderItemDeadline,
  updateOrderItem,
  updateOrderItemProgress,
} from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");
const moneyString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount.");
// Owner-directed simplification (confirmed directly, 2026-09-27: "currently
// there are only two sources for order Fiverr and External"), replacing the
// original generic four-value enum.
const orderSourceSchema = z.enum(["FIVERR", "EXTERNAL"]);

/**
 * A deadline is a plain string all the way to `new Date(...)` in
 * `normalizeOrderInput`/service.ts — without this, a malformed value
 * silently became `Invalid Date` instead of a caught validation error
 * (found 2026-10-09 during the order-creation simplification pass).
 * Accepts the empty/absent case (still optional) and anything
 * `Date.parse` can read, including `datetime-local`'s "no seconds, no
 * timezone" format.
 */
const deadlineSchema = z
  .string()
  .nullable()
  .optional()
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), "Enter a valid deadline.");

/**
 * Cross-field: a Fiverr-sourced order needs one of your Fiverr accounts
 * (confirmed directly, 2026-09-27: "fiverr account should be taken if
 * source is Fiverr"). Unified here into one schema-level check
 * (2026-10-09) — previously duplicated as a client-side disabled-button
 * condition AND a server-side `createOrder`/`updateOrder` check; the
 * service-layer check stays as defense in depth for any other caller, but
 * this is now the ONE place the Action boundary itself enforces it, with a
 * normal field-level error instead of an inertly disabled button.
 */
function requireFiverrAccountForFiverrSource(data: { source: string; fiverrAccountId?: string | null }, ctx: z.RefinementCtx) {
  if (data.source === "FIVERR" && !data.fiverrAccountId) {
    ctx.addIssue({ code: "custom", message: "Choose which Fiverr account this order came in on.", path: ["fiverrAccountId"] });
  }
}

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

const orderInputSchema = z.object({
  source: orderSourceSchema,
  externalReference: z.string().trim().max(160).optional(),
  customerId: uuid.nullable().optional(),
  // Required by the service layer when source === "FIVERR" — see
  // `requireFiverrAccountForFiverrSource`; ignored, and forced to null, for
  // an EXTERNAL order.
  fiverrAccountId: uuid.nullable().optional(),
  deadline: deadlineSchema,
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
  const parsed = orderInputSchema.superRefine(requireFiverrAccountForFiverrSource).safeParse(input);
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
  const parsed = orderIdSchema.extend(orderInputSchema.shape).superRefine(requireFiverrAccountForFiverrSource).safeParse(input);
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
  // Only the manual steps: every other order status is calculated from the
  // items (owner-directed rework, 2026-11-03 — see state-machine.ts).
  status: z.enum(["DELIVERED", "FINALIZED", "CANCELLED"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function changeOrderStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("orders.change_status");
  if (!auth.ok) return { ok: false, error: auth.message };
  // `orders.change_status` is shared with ITEM status changes, which an
  // External Worker needs for their own items. The whole order's status is
  // only for people who manage every order (owner request, 2026-11-03):
  // without this, a worker could move or cancel any order, even one they
  // have no item on.
  if (!canChangeWholeOrderStatus((key) => auth.actor.permissions.has(key))) {
    return { ok: false, error: "Only people who manage all orders can change an order's status." };
  }

  const result = await changeOrderStatus(auth.actor, parsed.data.orderId, parsed.data.status, parsed.data.reason);
  if (result.ok) {
    revalidatePath(`/orders/${parsed.data.orderId}`);
    revalidatePath("/orders");
  }
  return result.ok ? { ok: true, message: "Status updated." } : { ok: false, error: result.error };
}


// ---------------------------------------------------------------------------
// Order items
// ---------------------------------------------------------------------------

const orderItemInputSchema = z.object({
  serviceId: uuid,
  description: z.string().trim().max(4000).optional(),
  deadline: deadlineSchema,
  // Only meaningful when the chosen service has a metric type — the service
  // layer enforces that requirement (it alone knows the service's metricType),
  // so these are just format checks here, not requiredness.
  channelLink: z.union([z.url("Enter a valid URL, including https://."), z.literal("")]).optional(),
  targetCount: z.coerce.number().int().min(0, "Cannot be negative.").optional(),
  currentCount: z.coerce.number().int().min(0, "Cannot be negative.").optional(),
  // No workerCost/workerCostCurrency here, 2026-10-08 — see service.ts's
  // OrderItemInput doc comment: cost now lives entirely with assignment.
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
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orders/${parsed.data.orderId}`);
  return { ok: true, message: "Item added.", itemId: result.data.id };
}

const itemIdSchema = z.object({ itemId: uuid });

/**
 * Sets an item's worker deadline by hand, or resets it to automatic
 * (`deadline: null`). The browser sends a full ISO timestamp, so the time
 * the person picked in their own timezone is the time stored.
 */
export async function setOrderItemDeadlineAction(input: unknown): Promise<ActionResult> {
  const parsed = itemIdSchema
    .extend({ deadline: z.iso.datetime({ offset: true, message: "Enter a valid date and time." }).nullable() })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("orders.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setOrderItemDeadline(
    auth.actor,
    parsed.data.itemId,
    parsed.data.deadline ? new Date(parsed.data.deadline) : null,
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: result.data.overridden ? "Item deadline updated." : "Item deadline set back to automatic." };
}

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

// Assignment is External-Worker-only, 2026-10-08 — see assignOrderItemWorker's
// doc comment in service.ts. `cost` distinguishes "not sent at all" (service
// auto-computes from the worker's rate) from "sent as ''" (explicitly no
// cost) via `.optional()` without a default — both are valid, that's why it
// isn't just `moneyString.optional()`.
const assignWorkerSchema = z.object({
  itemId: uuid,
  outsourcedWorkerId: uuid.nullable(),
  cost: z.union([moneyString, z.literal("")]).optional(),
  costCurrency: z.string().trim().length(3).optional(),
});

export async function assignOrderItemWorkerAction(input: unknown): Promise<ActionResult> {
  const parsed = assignWorkerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("orders.assign");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await assignOrderItemWorker(auth.actor, parsed.data.itemId, {
    outsourcedWorkerId: parsed.data.outsourcedWorkerId,
    cost: parsed.data.cost,
    costCurrency: parsed.data.costCurrency,
  });
  return result.ok ? { ok: true, message: "Assignment updated." } : { ok: false, error: result.error };
}

const changeItemStatusSchema = z.object({
  itemId: uuid,
  status: z.enum(["PENDING", "PROCESSING", "DONE", "REFILL", "CANCELLED"]),
});

export async function changeOrderItemStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = changeItemStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("orders.change_status");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await changeOrderItemStatus(auth.actor, parsed.data.itemId, parsed.data.status);
  return result.ok ? { ok: true, message: "Item status updated." } : { ok: false, error: result.error };
}

const updateItemProgressSchema = z.object({
  itemId: uuid,
  currentCount: z.number().int().min(0, "Enter a whole number, zero or more."),
});

export async function updateOrderItemProgressAction(input: unknown): Promise<ActionResult> {
  const parsed = updateItemProgressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("orders.change_status");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateOrderItemProgress(auth.actor, parsed.data.itemId, parsed.data.currentCount);
  return result.ok ? { ok: true, message: "Progress updated." } : { ok: false, error: result.error };
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

