"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

export type NotificationBellItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
};

/**
 * The notification centre popover (specification Section 67). Server-
 * rendered on every navigation from `(app)/layout.tsx` — no Supabase
 * Realtime subscription yet (docs/NOTIFICATIONS.md §9 deferred this phase
 * alongside the Redis/BullMQ queue, see messaging.prisma's header comment),
 * so the count only updates on the next navigation or a manual action here,
 * not instantly in the background.
 */
export function NotificationBell({
  initialUnreadCount,
  items,
}: {
  initialUnreadCount: number;
  items: readonly NotificationBellItem[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const markRead = (id: string) => {
    startTransition(async () => {
      await markNotificationReadAction({ id });
      router.refresh();
    });
  };

  const markAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-label={initialUnreadCount > 0 ? `Notifications, ${initialUnreadCount} unread` : "Notifications"}
        className={cn(
          "relative flex size-8 items-center justify-center rounded-[3px] text-ink-muted transition-colors",
          "hover:bg-canvas-subtle hover:text-ink",
        )}
      >
        <Bell aria-hidden="true" className="size-4" />
        {initialUnreadCount > 0 ? (
          <span className="absolute right-1 top-1 inline-flex size-3.5 items-center justify-center rounded-full bg-ink text-[9px] font-medium text-canvas">
            {initialUnreadCount > 9 ? "9+" : initialUnreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div id="notification-panel" role="region" aria-label="Notifications" className="absolute right-0 z-50 mt-1 w-80 border border-line bg-canvas shadow-sm">
          <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
            <p className="text-[13px] font-medium text-ink">Notifications</p>
            {initialUnreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                disabled={pending}
                className="text-xs text-ink-muted hover:text-ink hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-[13px] text-ink-faint">Nothing yet.</li>
            ) : (
              items.map((item) => (
                <li key={item.id} className="border-b border-line-soft last:border-0">
                  <div className={cn("flex items-start gap-2 px-3 py-2.5", !item.isRead && "bg-canvas-subtle")}>
                    <div className="min-w-0 flex-1">
                      {item.actionUrl ? (
                        <Link
                          href={item.actionUrl}
                          onClick={() => setOpen(false)}
                          className="block truncate text-[13px] font-medium text-ink hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <p className="truncate text-[13px] font-medium text-ink">{item.title}</p>
                      )}
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{item.message}</p>
                    </div>
                    {!item.isRead ? (
                      <button
                        type="button"
                        onClick={() => markRead(item.id)}
                        disabled={pending}
                        aria-label="Mark read"
                        className="mt-0.5 size-2 shrink-0 rounded-full bg-ink"
                      />
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line-soft px-3 py-2 text-center text-xs text-ink-muted hover:text-ink hover:underline"
          >
            View all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
