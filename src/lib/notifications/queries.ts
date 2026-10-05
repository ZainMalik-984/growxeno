import "server-only";

import type { MessageStatus, NotificationChannel, NotificationEvent } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ALL_NOTIFICATION_CHANNELS, ALL_NOTIFICATION_EVENTS, getDefaultPreference } from "./events";

/**
 * Read queries for Notifications, Templates, Preferences and Message Logs
 * (specification Sections 65-74).
 */

export type NotificationRow = {
  id: string;
  type: NotificationEvent;
  title: string;
  message: string;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  createdAt: Date;
};

export async function listNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<NotificationRow[]> {
  return prisma.notification.findMany({
    where: { recipientId: userId, ...(options.unreadOnly ? { isRead: false } : {}) },
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      isRead: true,
      entityType: true,
      entityId: true,
      actionUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
  });
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { recipientId: userId, isRead: false } });
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export type PreferenceRow = {
  event: NotificationEvent;
  channel: NotificationChannel;
  enabled: boolean;
  isDefault: boolean;
};

/** The full event x channel matrix for one user, overrides merged onto defaults. */
export async function getEffectivePreferences(userId: string): Promise<PreferenceRow[]> {
  const overrides = await prisma.notificationPreference.findMany({
    where: { userId },
    select: { event: true, channel: true, enabled: true },
  });
  const overrideMap = new Map(overrides.map((o) => [`${o.event}:${o.channel}`, o.enabled]));

  const rows: PreferenceRow[] = [];
  for (const event of ALL_NOTIFICATION_EVENTS) {
    for (const channel of ALL_NOTIFICATION_CHANNELS) {
      const key = `${event}:${channel}`;
      const override = overrideMap.get(key);
      rows.push({
        event,
        channel,
        enabled: override ?? getDefaultPreference(event, channel),
        isDefault: override === undefined,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type TemplateRow = {
  id: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  name: string;
  subject: string | null;
  body: string;
  requiredVariables: string[];
  metaTemplateName: string | null;
  metaTemplateLanguage: string | null;
  isActive: boolean;
  updatedAt: Date;
};

const templateSelect = {
  id: true,
  event: true,
  channel: true,
  name: true,
  subject: true,
  body: true,
  requiredVariables: true,
  metaTemplateName: true,
  metaTemplateLanguage: true,
  isActive: true,
  updatedAt: true,
} as const;

export async function listTemplates(): Promise<TemplateRow[]> {
  return prisma.notificationTemplate.findMany({
    select: templateSelect,
    orderBy: [{ event: "asc" }, { channel: "asc" }],
  });
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  return prisma.notificationTemplate.findUnique({ where: { id }, select: templateSelect });
}

// ---------------------------------------------------------------------------
// Message logs
// ---------------------------------------------------------------------------

export type MessageLogRow = {
  id: string;
  recipientLabel: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  status: MessageStatus;
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
};

export type MessageLogFilters = {
  status?: MessageStatus;
  channel?: NotificationChannel;
  event?: NotificationEvent;
  limit?: number;
};

export async function listMessageLogs(filters: MessageLogFilters = {}): Promise<MessageLogRow[]> {
  return prisma.messageLog.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.event ? { event: filters.event } : {}),
    },
    select: {
      id: true,
      recipientLabel: true,
      channel: true,
      event: true,
      status: true,
      error: true,
      createdAt: true,
      sentAt: true,
      deliveredAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 100,
  });
}
