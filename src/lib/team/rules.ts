import { SERVICE_METRIC_TYPE_LABELS, type ServiceMetricType } from "@/lib/services/metric-type";

/**
 * An outsourced worker's own team (owner request, 2026-11-17): the rules for
 * splitting an order item among their people. Pure, so it is unit-tested and
 * shared by the server and the popups.
 *
 * A share is PROCESSING from the moment it is handed over and DONE only when
 * the worker marks it so; the "done" number is a note of progress and never
 * changes the status by itself.
 */

export type TeamShareStatus = "PROCESSING" | "DONE";

export type ShareItemInput = {
  metricType: ServiceMetricType | null;
  startingCount: number | null;
  targetCount: number | null;
};

const numberFormat = new Intl.NumberFormat("en-US");
export const formatCount = (n: number) => numberFormat.format(n);

/** How much the item asks for (target − starting), or null for a service without a count. */
export function requiredAmount(item: ShareItemInput): number | null {
  if (!item.metricType || item.targetCount === null) return null;
  return Math.max(0, item.targetCount - Math.max(0, item.startingCount ?? 0));
}

/** "watch hours", "subscribers"…, or null without a count. */
export function unitOf(item: Pick<ShareItemInput, "metricType">): string | null {
  return item.metricType ? SERVICE_METRIC_TYPE_LABELS[item.metricType].toLowerCase() : null;
}

/** What is still not handed to anyone (never below 0), or null without a count. */
export function remainingToAllocate(item: ShareItemInput, shares: readonly { id?: string; amount: number | null }[], exceptShareId?: string): number | null {
  const required = requiredAmount(item);
  if (required === null) return null;
  const given = shares.reduce((sum, s) => (s.id !== undefined && s.id === exceptShareId ? sum : sum + (s.amount ?? 0)), 0);
  return Math.max(0, required - given);
}

/**
 * Checks a share's amount against what is left of the item. Returns an error
 * message, or null when it fits. On an item without a count (a website, say)
 * the amount is optional and has no ceiling (owner request, 2026-11-17): the
 * worker still notes how many each person got, e.g. 5 pages.
 */
export function amountProblem(item: ShareItemInput, shares: readonly { id?: string; amount: number | null }[], amount: number | null, exceptShareId?: string): string | null {
  const remaining = remainingToAllocate(item, shares, exceptShareId);
  if (remaining === null) return amount === null || (Number.isInteger(amount) && amount > 0) ? null : "Enter a whole number above 0, or leave it empty.";
  if (amount === null || !Number.isInteger(amount) || amount <= 0) return "Enter how much they'll do.";
  if (amount > remaining) {
    return remaining === 0 ? "Everything on this task is already assigned." : `Only ${formatCount(remaining)} is left to assign.`;
  }
  return null;
}

/** Progress kept between 0 and the share's amount (or ≥ 0 when it has none). */
export function clampDone(done: number, amount: number | null): number {
  const n = Number.isFinite(done) ? Math.max(0, Math.round(done)) : 0;
  return amount === null ? n : Math.min(n, amount);
}

/** Status change by hand: what to store. */
export function markShare(status: TeamShareStatus, now: Date): { status: TeamShareStatus; finishedAt: Date | null } {
  return status === "DONE" ? { status: "DONE", finishedAt: now } : { status: "PROCESSING", finishedAt: null };
}

/** "2d 4h", "3h 10m", "8m", "just now". */
export function formatSpan(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return mins > 0 ? `${mins}m` : "just now";
}

/** "Took 2d 4h" once done, "2d 4h so far" while processing. */
export function shareDuration(share: { assignedAt: Date | string; finishedAt: Date | string | null; status: TeamShareStatus }, now: Date): string {
  const start = new Date(share.assignedAt).getTime();
  if (share.status === "DONE" && share.finishedAt) {
    const took = formatSpan(new Date(share.finishedAt).getTime() - start);
    return took === "just now" ? "Took under a minute" : `Took ${took}`;
  }
  const span = formatSpan(now.getTime() - start);
  return span === "just now" ? "Just started" : `${span} so far`;
}

export type ShareMessageInput = ShareItemInput & {
  memberName: string;
  orderNumber: number;
  /** "Youtube · Watch Hours" */
  serviceName: string;
  channelLink: string | null;
  amount: number | null;
  note: string | null;
};

/**
 * The WhatsApp text the worker sends a team member for their part: just the
 * link, their part and the note (owner request, 2026-11-17: no "new task ·
 * Order #… · service" heading line).
 */
export function shareMessage(input: ShareMessageInput): string {
  const unit = unitOf(input);
  const lines: string[] = [];
  if (input.channelLink) lines.push(`Link: ${input.channelLink}`);
  if (input.amount !== null) lines.push(`Your part: ${formatCount(input.amount)}${unit ? ` ${unit}` : ""}`);
  if (input.note?.trim()) lines.push(`Note: ${input.note.trim()}`);
  return lines.join("\n");
}
