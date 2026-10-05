"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

export type NotificationListItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAtLabel: string;
};

export function NotificationList({ items }: { items: NotificationListItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unreadCount = items.filter((item) => !item.isRead).length;

  const markRead = (id: string) => {
    startTransition(async () => {
      const result = await markNotificationReadAction({ id });
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  };

  const markAllRead = () => {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      router.refresh();
    });
  };

  return (
    <div>
      {unreadCount > 0 ? (
        <div className="mb-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={pending}>
            Mark all read
          </Button>
        </div>
      ) : null}

      <ul className="divide-y divide-line-soft">
        {items.map((item) => (
          <li key={item.id} className={cn("flex items-start justify-between gap-4 py-3", !item.isRead && "bg-canvas-subtle")}>
            <div className="min-w-0">
              {item.actionUrl ? (
                <Link href={item.actionUrl} className="text-[13px] font-medium text-ink hover:underline">
                  {item.title}
                </Link>
              ) : (
                <p className="text-[13px] font-medium text-ink">{item.title}</p>
              )}
              <p className="mt-0.5 text-[13px] text-ink-muted">{item.message}</p>
              <p className="mt-1 text-xs text-ink-faint">{item.createdAtLabel}</p>
            </div>
            {!item.isRead ? (
              <Button variant="ghost" size="sm" onClick={() => markRead(item.id)} disabled={pending} className="shrink-0">
                Mark read
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
