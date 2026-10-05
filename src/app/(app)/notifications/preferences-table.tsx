"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import type { NotificationChannel, NotificationEvent } from "@/generated/prisma/client";
import { setNotificationPreferenceAction } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

export type PreferenceCell = {
  event: NotificationEvent;
  channel: NotificationChannel;
  enabled: boolean;
  isDefault: boolean;
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: "In-app",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

export function PreferencesTable({
  eventLabels,
  cells,
}: {
  eventLabels: Record<NotificationEvent, string>;
  cells: PreferenceCell[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const byEvent = new Map<NotificationEvent, PreferenceCell[]>();
  for (const cell of cells) {
    const list = byEvent.get(cell.event) ?? [];
    list.push(cell);
    byEvent.set(cell.event, list);
  }

  const toggle = (cell: PreferenceCell) => {
    startTransition(async () => {
      const result = await setNotificationPreferenceAction({
        event: cell.event,
        channel: cell.channel,
        enabled: !cell.enabled,
      });
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-xs text-ink-faint">
            <th className="py-2 pr-4 font-normal">Event</th>
            {(["IN_APP", "EMAIL", "WHATSAPP"] as const).map((channel) => (
              <th key={channel} className="py-2 pr-4 font-normal">
                {CHANNEL_LABELS[channel]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(byEvent.entries()).map(([event, row]) => (
            <tr key={event} className="border-b border-line-soft">
              <td className="py-2 pr-4 text-ink">{eventLabels[event]}</td>
              {row.map((cell) => (
                <td key={cell.channel} className="py-2 pr-4">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cell.enabled}
                    aria-label={`${eventLabels[event]} via ${CHANNEL_LABELS[cell.channel]}`}
                    onClick={() => toggle(cell)}
                    disabled={pending}
                    className={cn(
                      "h-5 w-9 rounded-full transition-colors",
                      cell.enabled ? "bg-ink" : "bg-zinc-200",
                    )}
                  >
                    <span
                      className={cn(
                        "block size-4 rounded-full bg-canvas transition-transform",
                        cell.enabled ? "translate-x-[18px]" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
