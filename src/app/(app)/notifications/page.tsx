import type { Metadata } from "next";

import { EmptyState, PageHeader, Section } from "@/components/ui/page";
import { requireActor } from "@/lib/auth/authorize";
import { NOTIFICATION_EVENT_LABELS } from "@/lib/notifications/events";
import { getEffectivePreferences, listNotifications } from "@/lib/notifications/queries";
import { NotificationList } from "./notification-list";
import { PreferencesTable } from "./preferences-table";

export const metadata: Metadata = { title: "Notifications" };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/**
 * Notification centre (specification Section 67) + per-event, per-channel
 * preferences (Section 74). Self-service only — every user manages their
 * own, no permission key needed, same reasoning as Daily Statistics'
 * self-view.
 */
export default async function NotificationsPage() {
  const actor = await requireActor();

  const [notifications, preferences] = await Promise.all([
    listNotifications(actor.user.id, { limit: 100 }),
    getEffectivePreferences(actor.user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="What you've been told about, and how you want to hear about it next time."
      />

      <Section title="All notifications">
        {notifications.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            description="Assignments, revisions and completions you're involved in will show up here."
          />
        ) : (
          <NotificationList
            items={notifications.map((n) => ({
              id: n.id,
              title: n.title,
              message: n.message,
              isRead: n.isRead,
              actionUrl: n.actionUrl,
              createdAtLabel: `${dateFormat.format(n.createdAt)} UTC`,
            }))}
          />
        )}
      </Section>

      <Section
        title="Preferences"
        description="Email and WhatsApp are not sent yet — no queue is configured (docs/NOTIFICATIONS.md) — but your choice here takes effect the moment they are, with no need to set it again."
      >
        <PreferencesTable eventLabels={NOTIFICATION_EVENT_LABELS} cells={preferences} />
      </Section>
    </>
  );
}
