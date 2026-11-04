import { z } from "zod";

/**
 * How early an External Worker's deadline is, compared with the order's own
 * deadline (2026-11-03, owner request: "his deadline should be one day less
 * than the actual order time … there should be tiers like if the order
 * deadline is 50 days away, do −5 for the worker").
 *
 * Owner's choices, confirmed directly the same day:
 * - Tiers are measured by LEAD TIME: from when the order was created to its
 *   deadline. So a worker's deadline never moves as days pass.
 * - Tiers read "at least N days → X days early". The tier with the largest N
 *   that fits wins; when none fits, `defaultDays` applies.
 *
 * Pure — no database — so it is unit-tested (tests/unit/worker-deadline.test.ts).
 */

export const WORKER_DEADLINE_SETTING_KEY = "worker_deadline_buffer";

const MAX_DAYS = 365;

const tierSchema = z.object({
  minLeadDays: z.coerce.number().int("Use whole days.").min(1, "At least 1 day.").max(MAX_DAYS * 3),
  bufferDays: z.coerce.number().int("Use whole days.").min(0, "Cannot be negative.").max(MAX_DAYS),
});

export const workerDeadlineSettingsSchema = z
  .object({
    defaultDays: z.coerce.number().int("Use whole days.").min(0, "Cannot be negative.").max(MAX_DAYS),
    tiers: z.array(tierSchema).max(20, "Up to 20 rules."),
  })
  .refine(
    (value) => new Set(value.tiers.map((t) => t.minLeadDays)).size === value.tiers.length,
    { message: "Two rules use the same number of days.", path: ["tiers"] },
  );

export type WorkerDeadlineTier = z.infer<typeof tierSchema>;
export type WorkerDeadlineSettings = z.infer<typeof workerDeadlineSettingsSchema>;

/** Also seeded by the migration that added this setting — keep the two in step. */
export const DEFAULT_WORKER_DEADLINE_SETTINGS: WorkerDeadlineSettings = {
  defaultDays: 1,
  tiers: [
    { minLeadDays: 50, bufferDays: 5 },
    { minLeadDays: 10, bufferDays: 4 },
  ],
};

/** Reads a stored value, falling back to the defaults if it is missing or malformed. */
export function parseWorkerDeadlineSettings(value: unknown): WorkerDeadlineSettings {
  const parsed = workerDeadlineSettingsSchema.safeParse(value);
  return parsed.success ? normalizeSettings(parsed.data) : DEFAULT_WORKER_DEADLINE_SETTINGS;
}

/** Tiers sorted longest lead time first, the order they are checked in. */
export function normalizeSettings(settings: WorkerDeadlineSettings): WorkerDeadlineSettings {
  return { ...settings, tiers: [...settings.tiers].sort((a, b) => b.minLeadDays - a.minLeadDays) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many days early the worker's deadline is for an order with this much lead time. */
export function bufferDaysFor(leadMs: number, settings: WorkerDeadlineSettings): number {
  const leadDays = leadMs / DAY_MS;
  const tier = normalizeSettings(settings).tiers.find((t) => leadDays >= t.minLeadDays);
  return tier ? tier.bufferDays : settings.defaultDays;
}

/**
 * The worker's deadline for an order. Never more than half the lead time
 * earlier, so a short order cannot hand the worker a deadline that has
 * already passed the moment the order was created.
 */
export function computeWorkerDeadline(
  orderDeadline: Date | null,
  orderCreatedAt: Date,
  settings: WorkerDeadlineSettings,
): Date | null {
  if (!orderDeadline) return null;
  const leadMs = orderDeadline.getTime() - orderCreatedAt.getTime();
  if (leadMs <= 0) return new Date(orderDeadline);
  const bufferMs = Math.min(bufferDaysFor(leadMs, settings) * DAY_MS, leadMs / 2);
  return new Date(orderDeadline.getTime() - bufferMs);
}
