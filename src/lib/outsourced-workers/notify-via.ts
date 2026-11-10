/**
 * Where an External Worker's new-task message goes (owner request,
 * 2026-11-11). Email is sent by the app; WhatsApp is a prefilled message an
 * admin sends with one tap. Pure, safe for client and server.
 */
export const WORKER_NOTIFY_CHANNELS = ["BOTH", "EMAIL", "WHATSAPP", "NONE"] as const;
export type WorkerNotifyChannel = (typeof WORKER_NOTIFY_CHANNELS)[number];

export const WORKER_NOTIFY_LABELS: Record<WorkerNotifyChannel, string> = {
  BOTH: "Email and WhatsApp",
  EMAIL: "Email only",
  WHATSAPP: "WhatsApp only",
  NONE: "Don't send",
};

export function wantsEmail(channel: WorkerNotifyChannel): boolean {
  return channel === "EMAIL" || channel === "BOTH";
}

export function wantsWhatsapp(channel: WorkerNotifyChannel): boolean {
  return channel === "WHATSAPP" || channel === "BOTH";
}
