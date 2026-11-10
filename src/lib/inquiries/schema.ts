import { z } from "zod";

/**
 * What the public contact form may send (2026-11-04). Pure, so it is
 * unit-tested and shared by the server action. Limits keep one submission
 * small; the server also rate-limits per visitor (service.ts).
 */

/** Hidden field real visitors never see or fill; bots usually do. */
export const HONEYPOT_FIELD = "company";

export const inquirySchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(160, "That name is too long."),
  email: z.email("Please enter a valid email address.").trim().max(320, "That email is too long."),
  service: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || null),
  message: z.string().trim().min(5, "Please tell us a little about what you need.").max(5000, "Please keep your message under 5,000 characters."),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export const INQUIRY_STATUS_LABELS = {
  NEW: "New",
  CONTACTED: "Contacted",
  CLOSED: "Closed",
} as const;
