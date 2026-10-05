import "server-only";

import type { NotificationChannel, NotificationEvent, Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import {
  runTransaction,
  ServiceRejection,
  serviceFailure as failure,
  type ServiceResult,
  type TransactionClient,
} from "@/lib/db/transaction";
import { getDefaultPreference, validateTemplateVariables } from "./events";

export type { ServiceResult };

// ---------------------------------------------------------------------------
// Emitting events (called from WITHIN another domain's transaction — orders,
// finance — the same pattern as logActivity/recordAudit in orders/service.ts)
// ---------------------------------------------------------------------------

export type NotificationRecipient = {
  userId: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
};

async function isInAppEnabled(tx: TransactionClient, userId: string, event: NotificationEvent): Promise<boolean> {
  const override = await tx.notificationPreference.findUnique({
    where: { userId_event_channel: { userId, event, channel: "IN_APP" } },
    select: { enabled: true },
  });
  return override?.enabled ?? getDefaultPreference(event, "IN_APP");
}

/**
 * Writes a durable `NotificationOutbox` row (intent for a future dispatcher —
 * the queue itself is deferred this phase, see messaging.prisma's header
 * comment) and, for every recipient with in-app enabled, a `Notification`
 * row. In-app is a plain database write, not a provider call, so it happens
 * synchronously here rather than waiting on a queue that does not exist yet.
 *
 * `recipients` may be empty (e.g. `ORDER_ITEM_STOP_WORK_REQUESTED`, whose
 * real recipient is an OutsourcedWorker with no User row to notify in-app) —
 * the outbox row is still written either way.
 */
export async function emitNotificationEvent(
  tx: TransactionClient,
  event: NotificationEvent,
  recipients: readonly NotificationRecipient[],
  payload: Prisma.InputJsonValue = {},
): Promise<void> {
  await tx.notificationOutbox.create({
    data: {
      eventType: event,
      payload: { ...(payload as object), recipientUserIds: recipients.map((r) => r.userId) } as Prisma.InputJsonValue,
    },
  });

  for (const recipient of recipients) {
    if (!(await isInAppEnabled(tx, recipient.userId, event))) continue;
    await tx.notification.create({
      data: {
        recipientId: recipient.userId,
        type: event,
        title: recipient.title,
        message: recipient.message,
        entityType: recipient.entityType,
        entityId: recipient.entityId,
        actionUrl: recipient.actionUrl,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// In-app notifications — read/write for the current user only
// ---------------------------------------------------------------------------

export async function markNotificationRead(actor: Actor, id: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const notification = await tx.notification.findUnique({ where: { id }, select: { recipientId: true } });
    if (!notification || notification.recipientId !== actor.user.id) {
      throw new ServiceRejection("Notification not found.");
    }
    await tx.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
  });
}

export async function markAllNotificationsRead(actor: Actor): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    await tx.notification.updateMany({
      where: { recipientId: actor.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  });
}

// ---------------------------------------------------------------------------
// Preferences — a user manages only their own (self-service, no permission
// key needed — same reasoning as daily-stats' self-view)
// ---------------------------------------------------------------------------

export async function setNotificationPreference(
  actor: Actor,
  event: NotificationEvent,
  channel: NotificationChannel,
  enabled: boolean,
): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    await tx.notificationPreference.upsert({
      where: { userId_event_channel: { userId: actor.user.id, event, channel } },
      create: { userId: actor.user.id, event, channel, enabled },
      update: { enabled },
    });
  });
}

// ---------------------------------------------------------------------------
// Templates — admin-managed (`templates.manage`, checked by the caller)
// ---------------------------------------------------------------------------

export type TemplateInput = {
  event: NotificationEvent;
  channel: NotificationChannel;
  name: string;
  subject?: string;
  body: string;
  requiredVariables: string[];
  metaTemplateName?: string;
  metaTemplateLanguage?: string;
};

function validate(input: TemplateInput): string | undefined {
  if (!input.name.trim()) return "Name is required.";
  if (!input.body.trim()) return "Body is required.";
  if (input.channel === "WHATSAPP" && !input.metaTemplateName) {
    return "WhatsApp templates require the Meta-approved template name.";
  }
  const bodyCheck = validateTemplateVariables(input.body, input.requiredVariables);
  if (!bodyCheck.ok) return bodyCheck.error;
  if (input.subject) {
    const subjectCheck = validateTemplateVariables(input.subject, []);
    if (!subjectCheck.ok) return subjectCheck.error;
  }
}

export async function createTemplate(actor: Actor, input: TemplateInput): Promise<ServiceResult<{ id: string }>> {
  const problem = validate(input);
  if (problem) return failure(problem);

  return runTransaction(async (tx) => {
    const clash = await tx.notificationTemplate.findUnique({
      where: { event_channel: { event: input.event, channel: input.channel } },
      select: { id: true },
    });
    if (clash) throw new ServiceRejection("A template for this event and channel already exists — edit it instead.");

    const created = await tx.notificationTemplate.create({
      data: {
        event: input.event,
        channel: input.channel,
        name: input.name.trim(),
        subject: input.subject?.trim() || null,
        body: input.body,
        requiredVariables: input.requiredVariables,
        metaTemplateName: input.metaTemplateName?.trim() || null,
        metaTemplateLanguage: input.metaTemplateLanguage?.trim() || null,
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "notification_template.created",
      entityType: "NotificationTemplate",
      entityId: created.id,
      summary: `Created "${input.name.trim()}" (${input.event} / ${input.channel})`,
      newValue: { event: input.event, channel: input.channel, name: input.name.trim() },
    });

    return { id: created.id };
  });
}

export async function updateTemplate(actor: Actor, id: string, input: TemplateInput): Promise<ServiceResult> {
  const problem = validate(input);
  if (problem) return failure(problem);

  return runTransaction(async (tx) => {
    const existing = await tx.notificationTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new ServiceRejection("Template not found.");

    await tx.notificationTemplate.update({
      where: { id },
      data: {
        name: input.name.trim(),
        subject: input.subject?.trim() || null,
        body: input.body,
        requiredVariables: input.requiredVariables,
        metaTemplateName: input.metaTemplateName?.trim() || null,
        metaTemplateLanguage: input.metaTemplateLanguage?.trim() || null,
      },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "notification_template.updated",
      entityType: "NotificationTemplate",
      entityId: id,
      summary: `Updated "${input.name.trim()}"`,
      newValue: { name: input.name.trim() },
    });
  });
}

export async function setTemplateActive(actor: Actor, id: string, isActive: boolean): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.notificationTemplate.findUnique({ where: { id }, select: { name: true } });
    if (!existing) throw new ServiceRejection("Template not found.");
    await tx.notificationTemplate.update({ where: { id }, data: { isActive } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: isActive ? "notification_template.reactivated" : "notification_template.deactivated",
      entityType: "NotificationTemplate",
      entityId: id,
      summary: `${isActive ? "Reactivated" : "Deactivated"} "${existing.name}"`,
    });
  });
}

/**
 * Unlike Expense (docs/REQUIREMENTS.md D8 — edit in place, no delete, because
 * historical financial records must keep resolving), a template has no
 * downstream record that depends on it existing: `MessageLog.templateId` is
 * nullable with `onDelete: SetNull` specifically so a log survives its
 * template being removed. Hard delete is the correct policy here, not a
 * gap — content configuration, not an audit trail.
 */
export async function deleteTemplate(actor: Actor, id: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.notificationTemplate.findUnique({ where: { id }, select: { name: true } });
    if (!existing) throw new ServiceRejection("Template not found.");

    await tx.notificationTemplate.delete({ where: { id } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "notification_template.deleted",
      entityType: "NotificationTemplate",
      entityId: id,
      summary: `Deleted "${existing.name}"`,
    });
  });
}
