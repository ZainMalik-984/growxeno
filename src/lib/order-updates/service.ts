import "server-only";

import { randomUUID } from "node:crypto";

import type { OrderItemStatus } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import { sniffImage } from "@/lib/categories/images";
import { prisma } from "@/lib/db/prisma";
import { runTransaction, ServiceRejection, serviceFailure as failure, type ServiceResult, type TransactionClient } from "@/lib/db/transaction";
import { CLOSED_ORDER_STATUSES } from "@/lib/orders/state-machine";
import { emitNotificationEvent } from "@/lib/notifications/service";
import { isAssignedToIdentity } from "@/lib/orders/assignment";
import { serviceLabel } from "@/lib/services/label";
import { SERVICE_METRIC_TYPE_LABELS, type ServiceMetricType } from "@/lib/services/metric-type";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optimizeUpdateImage } from "./optimize";
import {
  isEmptyUpdate,
  ITEM_UPDATE_BUCKET,
  ITEM_UPDATE_MAX_IMAGE_BYTES,
  ITEM_UPDATE_MAX_IMAGES,
  ITEM_UPDATE_MAX_TEXT,
  ITEM_UPDATE_MAX_TOTAL_BYTES,
  parseCount,
  updatePermissions,
  updateRecipients,
} from "./rules";
import { listActiveUserIdsWithPermission } from "@/lib/access/holders";

/**
 * Order item updates (2026-11-11, owner request): the worker posts progress
 * like a chat — a new count, text and screenshots — and the team can reply.
 *
 * Screenshots can show a client's private analytics, so they go to a PRIVATE
 * Storage bucket, uploaded and read only through the server with the secret
 * key. The browser loads them from this app (`/api/item-updates/…`), which
 * checks the viewer may see the item on every request. The bucket is created
 * on first use if it doesn't exist yet.
 */

const ITEM_SELECT = {
  id: true,
  orderId: true,
  status: true,
  workerId: true,
  outsourcedWorkerId: true,
  currentCount: true,
  startingCount: true,
  targetCount: true,
  order: { select: { orderNumber: true, createdById: true } },
  service: { select: { name: true, metricType: true, category: { select: { name: true } } } },
  outsourcedWorker: { select: { userId: true } },
} as const;

async function loadAccess(actor: Actor, itemId: string) {
  const item = await prisma.orderItem.findUnique({ where: { id: itemId }, select: ITEM_SELECT });
  if (!item) return null;
  const isTeam = actor.permissions.has("orders.view.all");
  const isAssignedWorker = isAssignedToIdentity(item, { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId });
  if (!isTeam && !isAssignedWorker) return null;
  const rights = updatePermissions({
    isTeam,
    isAssignedWorker,
    canChangeStatus: actor.permissions.has("orders.change_status"),
    status: item.status as OrderItemStatus,
    hasMetric: item.service.metricType !== null,
  });
  return { item, isTeam, isAssignedWorker, ...rights };
}

export type ItemUpdateView = {
  id: string;
  authorLabel: string;
  fromWorker: boolean;
  /** Posted by the person looking at it. */
  mine: boolean;
  body: string | null;
  countValue: number | null;
  previousCount: number | null;
  /** This app's own addresses for the screenshots (`/api/item-updates/…`), checked on every request. */
  images: string[];
  /** A worker asking for screenshots (2026-11-11). */
  isRequest: boolean;
  /** "SCREENSHOTS", or "WITHDRAW" when the worker can't continue. */
  requestType: "SCREENSHOTS" | "WITHDRAW";
  /** How a request was resolved, e.g. "600 watch hours moved to Taimoor". */
  resolutionNote: string | null;
  /** When a request was answered, and by whom; null while it waits. */
  resolvedAt: Date | null;
  resolvedByLabel: string | null;
  /** This post answered a screenshot request. */
  isAnswer: boolean;
  createdAt: Date;
};

export type ItemUpdatesThread = {
  itemId: string;
  orderNumber: number;
  serviceName: string;
  /** "watch hours", or null for an item without a count. */
  metricLabel: string | null;
  currentCount: number | null;
  startingCount: number | null;
  targetCount: number | null;
  canPost: boolean;
  canSetCount: boolean;
  /** The item's worker may ask the team for screenshots (none already waiting). */
  canAsk: boolean;
  /** The viewer is on the team and so may answer a request. */
  canAnswer: boolean;
  /** The screenshot request waiting for an answer, if any. */
  openRequest: { id: string; authorLabel: string; body: string | null } | null;
  /** The worker may say they can't continue (no such request waiting already). */
  canWithdraw: boolean;
  /** A "can't continue" request waiting for the team. */
  openWithdraw: { id: string; authorLabel: string; body: string | null } | null;
  updates: ItemUpdateView[];
};

/** Where the browser loads a screenshot from: this app, never Supabase directly (the CSP allows only 'self'). */
export function itemUpdateImageUrl(updateId: string, index: number): string {
  return `/api/item-updates/${updateId}/${index}`;
}

/**
 * One screenshot's bytes, for someone who can see the item it was posted on.
 * Null when there's no such image or the viewer may not see it (the route
 * answers 404 either way, so it never confirms an image exists).
 */
export async function readItemUpdateImage(actor: Actor, updateId: string, index: number): Promise<Blob | null> {
  const update = await prisma.orderItemUpdate.findUnique({ where: { id: updateId }, select: { orderItemId: true, imagePaths: true } });
  const path = update?.imagePaths[index];
  if (!update || !path) return null;
  if (!(await loadAccess(actor, update.orderItemId))) return null;
  try {
    const { data, error } = await createSupabaseAdminClient().storage.from(ITEM_UPDATE_BUCKET).download(path);
    return error ? null : data;
  } catch {
    return null;
  }
}

/** The item's thread, oldest first, for someone who can see the item. */
export async function getItemUpdatesThread(actor: Actor, itemId: string): Promise<ServiceResult<ItemUpdatesThread>> {
  const access = await loadAccess(actor, itemId);
  if (!access) return failure("That item isn't available to you.");
  const { item } = access;

  const rows = await prisma.orderItemUpdate.findMany({
    where: { orderItemId: itemId },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  const open = [...rows].reverse().find((row) => row.isRequest && row.requestType === "SCREENSHOTS" && !row.resolvedAt) ?? null;
  const openWithdraw = [...rows].reverse().find((row) => row.isRequest && row.requestType === "WITHDRAW" && !row.resolvedAt) ?? null;
  const isWorker = access.isAssignedWorker && !access.isTeam;

  return {
    ok: true,
    data: {
      itemId: item.id,
      orderNumber: item.order.orderNumber,
      serviceName: serviceLabel(item.service.name, item.service.category.name),
      metricLabel: item.service.metricType ? SERVICE_METRIC_TYPE_LABELS[item.service.metricType as ServiceMetricType].toLowerCase() : null,
      currentCount: item.currentCount,
      startingCount: item.startingCount,
      targetCount: item.targetCount,
      canPost: access.canPost,
      canSetCount: access.canSetCount,
      canAsk: isWorker && access.canPost && open === null && WITHDRAWABLE.has(item.status),
      canAnswer: access.isTeam,
      openRequest: open ? { id: open.id, authorLabel: open.authorLabel, body: open.body } : null,
      canWithdraw: isWorker && access.canPost && openWithdraw === null && WITHDRAWABLE.has(item.status),
      openWithdraw: openWithdraw ? { id: openWithdraw.id, authorLabel: openWithdraw.authorLabel, body: openWithdraw.body } : null,
      updates: rows.map((row) => ({
        id: row.id,
        authorLabel: row.authorLabel,
        fromWorker: row.fromWorker,
        mine: row.authorId === actor.user.id,
        body: row.body,
        countValue: row.countValue,
        previousCount: row.previousCount,
        images: row.imagePaths.map((_, index) => itemUpdateImageUrl(row.id, index)),
        isRequest: row.isRequest,
        requestType: row.requestType === "WITHDRAW" ? "WITHDRAW" : "SCREENSHOTS",
        resolutionNote: row.resolutionNote,
        resolvedAt: row.resolvedAt,
        resolvedByLabel: row.resolvedByLabel,
        isAnswer: row.answersRequestId !== null,
        createdAt: row.createdAt,
      })),
    },
  };
}

/**
 * Posts an update: uploads the screenshots, then in one transaction saves the
 * post, sets the item's count when one was given, logs it and tells the other
 * side. If the transaction fails the uploaded files are removed again.
 */
export async function postItemUpdate(
  actor: Actor,
  input: { itemId: string; body: string; count: string; files: File[]; answersRequestId?: string | null },
): Promise<ServiceResult<{ countChanged: boolean; answered: boolean }>> {
  const body = input.body.trim();
  if (body.length > ITEM_UPDATE_MAX_TEXT) return failure(`Keep the message under ${ITEM_UPDATE_MAX_TEXT} characters.`);
  const parsedCount = parseCount(input.count);
  if (!parsedCount.ok) return failure(parsedCount.error);
  const files = input.files.filter((file) => file.size > 0);
  if (files.length > ITEM_UPDATE_MAX_IMAGES) return failure(`Attach up to ${ITEM_UPDATE_MAX_IMAGES} screenshots.`);
  if (files.some((file) => file.size > ITEM_UPDATE_MAX_IMAGE_BYTES)) return failure("Each screenshot must be under 8 MB.");
  if (files.reduce((sum, file) => sum + file.size, 0) > ITEM_UPDATE_MAX_TOTAL_BYTES) {
    return failure("Those screenshots are too large together. Send fewer at a time.");
  }
  if (isEmptyUpdate({ body, count: parsedCount.value, imageCount: files.length })) {
    return failure("Write something, enter the new count, or add a screenshot.");
  }

  const access = await loadAccess(actor, input.itemId);
  if (!access) return failure("That item isn't available to you.");
  if (!access.canPost) return failure("You can't post updates on this item.");
  if (parsedCount.value !== null && !access.canSetCount) {
    return failure(access.item.service.metricType ? "Accept the task before updating the count." : "This item has no count to update.");
  }
  const answersRequestId = input.answersRequestId || null;
  if (answersRequestId) {
    if (!access.isTeam) return failure("Only the team can answer a screenshot request.");
    if (!body && files.length === 0) return failure("Add the screenshots or a message to answer the request.");
  }

  // Check and compress every screenshot before uploading any.
  const images: Buffer[] = [];
  for (const file of files) {
    const original = new Uint8Array(await file.arrayBuffer());
    if (!sniffImage(original)) return failure("Screenshots must be PNG, JPEG or WebP images.");
    const optimized = await optimizeUpdateImage(original);
    if (!optimized.ok) return failure(optimized.error);
    images.push(optimized.bytes);
  }

  const uploaded: string[] = [];
  if (images.length > 0) {
    let storage;
    try {
      storage = createSupabaseAdminClient().storage;
    } catch {
      return failure("Supabase administrative access is not configured.");
    }
    for (const bytes of images) {
      const path = `${input.itemId}/${randomUUID()}.webp`;
      let result = await storage.from(ITEM_UPDATE_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: false });
      if (result.error && /bucket not found/i.test(result.error.message)) {
        // First screenshot ever: make the private bucket, then try again.
        await storage.createBucket(ITEM_UPDATE_BUCKET, { public: false, fileSizeLimit: "4MB", allowedMimeTypes: ["image/webp"] });
        result = await storage.from(ITEM_UPDATE_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: false });
      }
      if (result.error) {
        if (uploaded.length > 0) await storage.from(ITEM_UPDATE_BUCKET).remove(uploaded).catch(() => {});
        return failure(`Upload failed: ${result.error.message}`);
      }
      uploaded.push(path);
    }
  }

  const { item } = access;
  const name = serviceLabel(item.service.name, item.service.category.name);
  const count = parsedCount.value;
  const fromWorker = access.isAssignedWorker && !access.isTeam;

  const result = await runTransaction(async (tx) => {
    // Re-read inside the transaction so "before" is exact.
    const fresh = await tx.orderItem.findUnique({ where: { id: item.id }, select: { currentCount: true, status: true } });
    if (!fresh) throw new ServiceRejection("That item no longer exists.");

    if (answersRequestId) {
      // Closes the request; a second answer racing this one finds it already closed.
      const closed = await tx.orderItemUpdate.updateMany({
        where: { id: answersRequestId, orderItemId: item.id, isRequest: true, requestType: "SCREENSHOTS", resolvedAt: null },
        data: { resolvedAt: new Date(), resolvedByLabel: actor.user.fullName.slice(0, 200) },
      });
      if (closed.count === 0) throw new ServiceRejection("That request was already answered. Post this as a normal update instead.");
    }

    await tx.orderItemUpdate.create({
      data: {
        orderItemId: item.id,
        authorId: actor.user.id,
        authorLabel: actor.user.fullName.slice(0, 200),
        fromWorker,
        body: body || null,
        countValue: count,
        previousCount: count !== null ? fresh.currentCount : null,
        imagePaths: uploaded,
        answersRequestId,
      },
    });

    if (count !== null) {
      await tx.orderItem.update({ where: { id: item.id }, data: { currentCount: count } });
    }

    const parts = [
      count !== null ? `set progress to ${count} / ${item.targetCount ?? 0}` : null,
      uploaded.length > 0 ? `${uploaded.length} screenshot${uploaded.length === 1 ? "" : "s"}` : null,
      body ? "a note" : null,
    ].filter(Boolean);
    const summary = `${actor.user.fullName} ${answersRequestId ? "answered the screenshot request" : "posted an update"} on "${name}" on order #${item.order.orderNumber}: ${parts.join(", ")}`;
    await tx.orderActivity.create({
      data: { orderId: item.orderId, actorId: actor.user.id, actorLabel: actor.user.fullName, action: "order_item.update_posted", summary },
    });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.update_posted",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      previousValue: count !== null ? { currentCount: fresh.currentCount } : undefined,
      newValue: { itemId: item.id, currentCount: count ?? undefined, images: uploaded.length, hasText: Boolean(body) },
    });

    const message = body
      ? `${actor.user.fullName}: ${body.slice(0, 140)}${body.length > 140 ? "…" : ""}`
      : count !== null
        ? `${actor.user.fullName} set the count to ${count.toLocaleString("en-US")}.`
        : `${actor.user.fullName} sent ${uploaded.length === 1 ? "a screenshot" : `${uploaded.length} screenshots`}.`;
    await notifyEveryoneOnItem(tx, actor, item, {
      title: answersRequestId ? `Screenshots sent: ${name} · #${item.order.orderNumber}` : `Update on ${name} · #${item.order.orderNumber}`,
      message,
    });
    return { countChanged: count !== null, answered: answersRequestId !== null };
  });

  if (!result.ok && uploaded.length > 0) {
    await createSupabaseAdminClient().storage.from(ITEM_UPDATE_BUCKET).remove(uploaded).catch(() => {});
  }
  return result;
}

type ItemForNotice = { id: string; orderId: string; workerId: string | null; outsourcedWorker: { userId: string | null } | null };

/**
 * Everyone who can see this order is told (2026-11-11): the whole team, and
 * this item's own worker. Workers on the order's other items are not, and
 * neither is the person who posted.
 */
export async function notifyEveryoneOnItem(
  tx: TransactionClient,
  actor: Actor,
  item: ItemForNotice,
  notice: { title: string; message: string; /** What the item's worker sees instead, when it differs. */ workerMessage?: string },
) {
  const recipients = updateRecipients({
    teamUserIds: await listActiveUserIdsWithPermission(tx, "orders.view.all"),
    itemWorkerUserIds: [item.outsourcedWorker?.userId ?? null, item.workerId],
    authorId: actor.user.id,
  });
  if (recipients.length === 0) return;
  await emitNotificationEvent(
    tx,
    "ORDER_ITEM_UPDATE_POSTED",
    recipients.map((recipient) => ({
      userId: recipient.userId,
      title: notice.title,
      message: recipient.isItemWorker && notice.workerMessage ? notice.workerMessage : notice.message,
      entityType: "Order",
      entityId: item.orderId,
      // The worker's link opens their task list; the team's opens the order page.
      actionUrl: recipient.isItemWorker ? `/orders?updates=${item.id}` : `/orders/${item.orderId}?updates=${item.id}`,
    })),
  );
}

/**
 * A worker asks the team for screenshots (2026-11-11, owner request: e.g. of a
 * channel's YouTube analytics they can't open). The message is optional: with
 * none, the request is just the notification. One open request per item at a
 * time; it stays open, with a badge for the team, until someone answers it.
 */
export async function requestScreenshots(actor: Actor, input: { itemId: string; message: string }): Promise<ServiceResult> {
  const message = input.message.trim();
  if (message.length > ITEM_UPDATE_MAX_TEXT) return failure(`Keep the message under ${ITEM_UPDATE_MAX_TEXT} characters.`);

  const access = await loadAccess(actor, input.itemId);
  if (!access) return failure("That item isn't available to you.");
  if (!access.isAssignedWorker || !access.canPost) {
    return failure(access.item.status === "PENDING" && access.isAssignedWorker ? "Accept the task first." : "Only the worker on this task can ask for screenshots.");
  }

  const { item } = access;
  const name = serviceLabel(item.service.name, item.service.category.name);
  return runTransaction(async (tx) => {
    const waiting = await tx.orderItemUpdate.count({ where: { orderItemId: item.id, isRequest: true, requestType: "SCREENSHOTS", resolvedAt: null } });
    if (waiting > 0) throw new ServiceRejection("You've already asked. The team will answer in the updates.");

    await tx.orderItemUpdate.create({
      data: {
        orderItemId: item.id,
        authorId: actor.user.id,
        authorLabel: actor.user.fullName.slice(0, 200),
        fromWorker: true,
        body: message || null,
        isRequest: true,
      },
    });

    const summary = `${actor.user.fullName} asked for screenshots on "${name}" on order #${item.order.orderNumber}`;
    await tx.orderActivity.create({
      data: { orderId: item.orderId, actorId: actor.user.id, actorLabel: actor.user.fullName, action: "order_item.screenshots_requested", summary },
    });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.screenshots_requested",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      newValue: { itemId: item.id, hasMessage: Boolean(message) },
    });
    await notifyEveryoneOnItem(tx, actor, item, {
      title: `Screenshots requested: ${name} · #${item.order.orderNumber}`,
      message: message ? `${actor.user.fullName}: ${message.slice(0, 140)}${message.length > 140 ? "…" : ""}` : `${actor.user.fullName} needs screenshots to continue.`,
    });
  });
}

/** A worker can give up a task they haven't finished. */
const WITHDRAWABLE = new Set(["PROCESSING", "REFILL"]);

/**
 * "I can't continue this" (2026-11-11, owner request): the worker on a task
 * tells the team they can't finish it, e.g. after 400 of 1,000 subscribers.
 * Nothing changes on the item yet; it stays flagged for the team, who either
 * move what's left to someone else (reassignRemainder in orders/service.ts)
 * or keep it with this worker (keepWithWorker below).
 */
export async function requestWithdraw(actor: Actor, input: { itemId: string; reason: string }): Promise<ServiceResult> {
  const reason = input.reason.trim();
  if (reason.length > ITEM_UPDATE_MAX_TEXT) return failure(`Keep the reason under ${ITEM_UPDATE_MAX_TEXT} characters.`);

  const access = await loadAccess(actor, input.itemId);
  if (!access) return failure("That item isn't available to you.");
  if (!access.isAssignedWorker || !access.canPost) return failure("Only the worker on this task can say they can't continue.");
  const { item } = access;
  if (!WITHDRAWABLE.has(item.status)) return failure(item.status === "PENDING" ? "Accept or reject the task first." : "This task is already finished.");

  const name = serviceLabel(item.service.name, item.service.category.name);
  const unit = item.service.metricType ? SERVICE_METRIC_TYPE_LABELS[item.service.metricType as ServiceMetricType].toLowerCase() : null;
  const start = Math.max(0, item.startingCount ?? 0);
  const done = Math.max(0, (item.currentCount ?? start) - start);
  const asked = Math.max(0, (item.targetCount ?? 0) - start);
  const progress = unit ? ` after ${done.toLocaleString("en-US")} of ${asked.toLocaleString("en-US")} ${unit}` : "";

  return runTransaction(async (tx) => {
    const waiting = await tx.orderItemUpdate.count({ where: { orderItemId: item.id, isRequest: true, requestType: "WITHDRAW", resolvedAt: null } });
    if (waiting > 0) throw new ServiceRejection("You've already told the team. They'll reassign it.");

    await tx.orderItemUpdate.create({
      data: {
        orderItemId: item.id,
        authorId: actor.user.id,
        authorLabel: actor.user.fullName.slice(0, 200),
        fromWorker: true,
        body: reason || null,
        isRequest: true,
        requestType: "WITHDRAW",
      },
    });

    const summary = `${actor.user.fullName} can't continue "${name}" on order #${item.order.orderNumber}${progress}`;
    await tx.orderActivity.create({
      data: { orderId: item.orderId, actorId: actor.user.id, actorLabel: actor.user.fullName, action: "order_item.withdraw_requested", summary },
    });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.withdraw_requested",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      newValue: { itemId: item.id, delivered: done, required: asked, hasReason: Boolean(reason) },
    });
    await notifyEveryoneOnItem(tx, actor, item, {
      title: `Can't continue: ${name} · #${item.order.orderNumber}`,
      message: `${actor.user.fullName} can't continue${progress}.${reason ? ` "${reason.slice(0, 120)}${reason.length > 120 ? "…" : ""}"` : ""} Reassign what's left.`,
    });
  });
}

/** The team decides the worker carries on after all: closes the "can't continue" request, item unchanged. */
export async function keepWithWorker(actor: Actor, input: { requestId: string; note: string }): Promise<ServiceResult> {
  if (!actor.permissions.has("orders.assign")) return failure("You don't have permission to reassign work.");
  const request = await prisma.orderItemUpdate.findUnique({ where: { id: input.requestId }, select: { orderItemId: true, isRequest: true, requestType: true, resolvedAt: true, authorLabel: true } });
  if (!request || !request.isRequest || request.requestType !== "WITHDRAW") return failure("That request no longer exists.");
  if (request.resolvedAt) return failure("That request was already handled.");
  const access = await loadAccess(actor, request.orderItemId);
  if (!access) return failure("That item isn't available to you.");
  const { item } = access;
  const note = input.note.trim().slice(0, 300);
  const name = serviceLabel(item.service.name, item.service.category.name);

  return runTransaction(async (tx) => {
    const closed = await tx.orderItemUpdate.updateMany({
      where: { id: input.requestId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedByLabel: actor.user.fullName.slice(0, 200), resolutionNote: `Kept with ${request.authorLabel}${note ? `: ${note}` : ""}`.slice(0, 300) },
    });
    if (closed.count === 0) throw new ServiceRejection("That request was already handled.");
    const summary = `${actor.user.fullName} kept "${name}" on order #${item.order.orderNumber} with ${request.authorLabel}`;
    await tx.orderActivity.create({
      data: { orderId: item.orderId, actorId: actor.user.id, actorLabel: actor.user.fullName, action: "order_item.withdraw_declined", summary },
    });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.withdraw_declined",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      newValue: { itemId: item.id, note },
    });
    await notifyEveryoneOnItem(tx, actor, item, {
      title: `Keep going: ${name} · #${item.order.orderNumber}`,
      message: `${actor.user.fullName} kept this task with ${request.authorLabel}.${note ? ` "${note}"` : ""}`,
    });
  });
}

/** Where open requests count: not on cancelled items or closed orders. */
export const OPEN_REQUEST_WHERE = {
  isRequest: true,
  resolvedAt: null,
  orderItem: { status: { not: "CANCELLED" as const }, order: { status: { notIn: [...CLOSED_ORDER_STATUSES] } } },
};

/** Screenshot requests still waiting for the team, for the sidebar badge. */
export async function countOpenScreenshotRequests(): Promise<number> {
  return prisma.orderItemUpdate.count({ where: OPEN_REQUEST_WHERE });
}
