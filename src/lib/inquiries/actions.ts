"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import { HONEYPOT_FIELD, inquirySchema } from "./schema";
import { createInquiry, hashIp, setInquiryStatus } from "./service";

export type InquiryActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * PUBLIC: the home page's contact form (no sign-in). Validates, drops obvious
 * bots silently (honeypot), rate-limits per visitor, then saves the inquiry.
 */
export async function submitInquiryAction(input: unknown): Promise<InquiryActionResult> {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  // A filled honeypot is a bot: pretend it worked, store nothing.
  if (typeof raw[HONEYPOT_FIELD] === "string" && raw[HONEYPOT_FIELD].trim() !== "") {
    return { ok: true, message: "Thanks — we'll be in touch soon." };
  }

  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const result = await createInquiry(parsed.data, { ipHash: hashIp(ip), userAgent: h.get("user-agent") });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/inquiries");
  revalidatePath("/dashboard");
  return { ok: true, message: "Thanks — we'll be in touch soon." };
}

const setStatusSchema = z.object({
  inquiryId: z.uuid("Invalid identifier."),
  status: z.enum(["NEW", "CONTACTED", "CLOSED"]),
});

export async function setInquiryStatusAction(input: unknown): Promise<InquiryActionResult> {
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("inquiries.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setInquiryStatus(auth.actor, parsed.data.inquiryId, parsed.data.status);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/inquiries");
  revalidatePath("/dashboard");
  return { ok: true, message: "Inquiry updated." };
}
