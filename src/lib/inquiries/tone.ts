import type { InquiryStatus } from "@/generated/prisma/client";
import type { StatusTone } from "@/components/ui/status-dot";

/** Badge colour per inquiry status, shared by the Inquiries page and the dashboard. */
export const INQUIRY_TONE: Record<InquiryStatus, StatusTone> = { NEW: "active", CONTACTED: "progress", CLOSED: "neutral" };
