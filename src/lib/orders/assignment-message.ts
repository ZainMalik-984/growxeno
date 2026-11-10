import { SERVICE_METRIC_TYPE_LABELS, type ServiceMetricType } from "@/lib/services/metric-type";

/**
 * The message an External Worker gets when a task is assigned to them (owner
 * request, 2026-11-11):
 *
 *   Link: …
 *   Need: 4,000 watch hours
 *   Current watch hours: 200
 *   Stop: 4,200 watch hours
 *
 *   Click to accept:
 *   <link to the task>
 *
 * Pure, so it is unit-tested and used for both email and WhatsApp.
 */

export type AssignmentMessageInput = {
  orderNumber: number;
  /** "Youtube · Watch Hours" */
  serviceName: string;
  metricType: ServiceMetricType | null;
  channelLink: string | null;
  startingCount: number | null;
  targetCount: number | null;
  acceptUrl: string;
};

export type AssignmentFigures = { need: number; current: number; stop: number; unit: string };

const numberFormat = new Intl.NumberFormat("en-US");

/** Need / Current / Stop for a metric task, or null when it has no counts. */
export function assignmentFigures(input: Pick<AssignmentMessageInput, "metricType" | "startingCount" | "targetCount">): AssignmentFigures | null {
  if (!input.metricType || input.targetCount === null) return null;
  const current = Math.max(0, input.startingCount ?? 0);
  return {
    need: Math.max(0, input.targetCount - current),
    current,
    stop: input.targetCount,
    unit: SERVICE_METRIC_TYPE_LABELS[input.metricType].toLowerCase(),
  };
}

export function buildAssignmentMessage(input: AssignmentMessageInput): { subject: string; text: string } {
  const figures = assignmentFigures(input);
  const lines = [`New task · Order #${input.orderNumber} · ${input.serviceName}`, ""];
  if (input.channelLink) lines.push(`Link: ${input.channelLink}`);
  if (figures) {
    lines.push(
      `Need: ${numberFormat.format(figures.need)} ${figures.unit}`,
      `Current ${figures.unit}: ${numberFormat.format(figures.current)}`,
      `Stop: ${numberFormat.format(figures.stop)} ${figures.unit}`,
    );
  }
  lines.push("", "Click to accept:", input.acceptUrl);
  return {
    subject: `New task: ${input.serviceName} (order #${input.orderNumber})`,
    text: lines.join("\n"),
  };
}

/**
 * A WhatsApp "click to chat" link with the message filled in, or null when the
 * number has no digits. International format without + or 00 ("+92 300 …" →
 * "92300…"); a local number starting with 0 is passed through as typed.
 */
export function whatsappUrl(number: string | null | undefined, text: string): string | null {
  const digits = (number ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** The task's accept link: the worker's Orders page with this task's popup open. */
export function acceptUrlFor(appUrl: string, itemId: string): string {
  return `${appUrl.replace(/\/$/, "")}/orders?open=${encodeURIComponent(itemId)}`;
}
