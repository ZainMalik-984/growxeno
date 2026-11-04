/**
 * Time left until a deadline, as days, hours and minutes (owner request,
 * 2026-11-03: deadlines "by default should show Days, hours, minutes").
 * Pure, so it is unit-tested.
 */

export type DeadlineUrgency = "overdue" | "soon" | "near" | "later";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3d 4h 12m", "4h 5m", "12m", "0m". Zero-value leading parts are dropped. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / MINUTE);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function describeDeadline(deadline: Date, now: number): { label: string; urgency: DeadlineUrgency } {
  const left = deadline.getTime() - now;
  if (left < 0) return { label: `Overdue by ${formatDuration(left)}`, urgency: "overdue" };
  return {
    label: `${formatDuration(left)} left`,
    urgency: left < DAY ? "soon" : left < 3 * DAY ? "near" : "later",
  };
}
