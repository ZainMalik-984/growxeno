import { z } from "zod";

/**
 * The fee Fiverr keeps from each Fiverr order, as a percentage (owner request,
 * 2026-11-04: "currently it's 20%"). Used to work out employee commission on
 * Fiverr orders (src/lib/finance/commission.ts). Pure, so it is unit-tested.
 */

export const FIVERR_FEE_SETTING_KEY = "fiverr_fee";

export const fiverrFeeSettingsSchema = z.object({
  percent: z.coerce
    .number({ message: "Enter a percentage." })
    .min(0, "Cannot be negative.")
    .max(100, "Cannot be more than 100%.")
    .refine((value) => Number.isInteger(value * 100), "Use at most two decimals."),
});

export type FiverrFeeSettings = z.infer<typeof fiverrFeeSettingsSchema>;

/** Also seeded by the migration that added this setting — keep the two in step. */
export const DEFAULT_FIVERR_FEE_SETTINGS: FiverrFeeSettings = { percent: 20 };

export function parseFiverrFeeSettings(value: unknown): FiverrFeeSettings {
  const parsed = fiverrFeeSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_FIVERR_FEE_SETTINGS;
}
