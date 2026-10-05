import type { NotificationChannel, NotificationEvent } from "@/generated/prisma/client";

/**
 * Pure notification logic (specification Sections 65, 70, 74): the closed
 * event list, human labels, system-default channel preferences, and
 * template variable validation. No database, no request context, no
 * `server-only` import — same reasoning as `src/lib/orders/state-machine.ts`.
 */

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  ORDER_CREATED: "Order created",
  ORDER_ASSIGNED: "Order assigned",
  ORDER_PROCESSED: "Order processed",
  ORDER_STARTED: "Order started",
  ORDER_COMPLETED: "Order completed",
  ORDER_REVISED: "Order sent for revision",
  DEADLINE_24H: "Deadline in 24 hours",
  DEADLINE_6H: "Deadline in 6 hours",
  DEADLINE_TODAY: "Deadline today",
  ORDER_OVERDUE: "Order overdue",
  PAYMENT_DUE: "Payment due",
  ORDER_ITEM_STOP_WORK_REQUESTED: "Stop work requested",
};

/**
 * System default, per specification Section 74's worked example (Order
 * Assigned / Order Completed / Deadline 6 Hours) plus a reasonable default
 * for every other event: in-app on (a notification centre with nothing in
 * it is useless), email/WhatsApp off until a template exists AND a queue can
 * actually dispatch it (docs/NOTIFICATIONS.md — deferred this phase). A
 * missing `NotificationPreference` row means "use this," never a duplicated
 * copy of these values in the database.
 */
const DEFAULTS: Record<NotificationEvent, Record<NotificationChannel, boolean>> = {
  ORDER_CREATED: { IN_APP: true, EMAIL: false, WHATSAPP: false },
  ORDER_ASSIGNED: { IN_APP: true, EMAIL: true, WHATSAPP: true },
  ORDER_PROCESSED: { IN_APP: true, EMAIL: false, WHATSAPP: false },
  ORDER_STARTED: { IN_APP: true, EMAIL: false, WHATSAPP: false },
  ORDER_COMPLETED: { IN_APP: true, EMAIL: true, WHATSAPP: false },
  ORDER_REVISED: { IN_APP: true, EMAIL: false, WHATSAPP: false },
  DEADLINE_24H: { IN_APP: true, EMAIL: false, WHATSAPP: false },
  DEADLINE_6H: { IN_APP: true, EMAIL: false, WHATSAPP: true },
  DEADLINE_TODAY: { IN_APP: true, EMAIL: false, WHATSAPP: false },
  ORDER_OVERDUE: { IN_APP: true, EMAIL: false, WHATSAPP: false },
  PAYMENT_DUE: { IN_APP: true, EMAIL: false, WHATSAPP: false },
  ORDER_ITEM_STOP_WORK_REQUESTED: { IN_APP: true, EMAIL: false, WHATSAPP: false },
};

export function getDefaultPreference(event: NotificationEvent, channel: NotificationChannel): boolean {
  return DEFAULTS[event][channel];
}

export const ALL_NOTIFICATION_EVENTS = Object.keys(NOTIFICATION_EVENT_LABELS) as NotificationEvent[];
export const ALL_NOTIFICATION_CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "WHATSAPP"];

/**
 * The closed variable set from specification Section 70, minus `buyer_name` — Buyer was removed
 * entirely from the system post-Phase-10 (2026-09-28, owner-directed), so there is no longer a
 * buyer name any dispatch could supply for it. Nothing has ever dispatched a real message (§7), so
 * no historical template body actually depended on this value being renderable.
 */
export const TEMPLATE_VARIABLES = [
  "worker_name",
  "order_id",
  "order_number",
  "service",
  "category",
  "deadline",
  "customer_name",
  "amount",
  "hours_remaining",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function extractPlaceholders(text: string): string[] {
  return Array.from(text.matchAll(PLACEHOLDER_PATTERN), (m) => m[1]);
}

export type TemplateValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Section 70: "Validate variables. Prevent broken placeholders." Every
 * `{{placeholder}}` actually present in the template text must be one of
 * the known variables, and every variable the template DECLARES as required
 * must actually appear somewhere in the text — a declared-but-unused
 * variable is as much a template bug as an unknown placeholder.
 */
export function validateTemplateVariables(
  text: string,
  requiredVariables: readonly string[],
): TemplateValidationResult {
  const used = new Set(extractPlaceholders(text));

  for (const placeholder of used) {
    if (!TEMPLATE_VARIABLES.includes(placeholder as TemplateVariable)) {
      return { ok: false, error: `Unknown placeholder "{{${placeholder}}}". Known variables: ${TEMPLATE_VARIABLES.join(", ")}.` };
    }
  }

  for (const declared of requiredVariables) {
    if (!TEMPLATE_VARIABLES.includes(declared as TemplateVariable)) {
      return { ok: false, error: `"${declared}" is not a known variable.` };
    }
    if (!used.has(declared)) {
      return { ok: false, error: `"${declared}" is declared as required but never used as {{${declared}}} in the template text.` };
    }
  }

  return { ok: true };
}

/**
 * Renders a template, substituting every declared variable. Throws rather
 * than sending a message reading "Hello {{worker_name}}" if a required
 * variable has no value at send time (Section 70).
 */
export function renderTemplate(text: string, variables: Partial<Record<TemplateVariable, string>>): string {
  return text.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
    const value = variables[name as TemplateVariable];
    if (value === undefined) {
      throw new Error(`Missing value for required template variable "{{${name}}}".`);
    }
    return value;
  });
}
