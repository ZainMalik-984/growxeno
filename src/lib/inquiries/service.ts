import "server-only";

import { createHmac } from "node:crypto";

import type { InquiryStatus } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { runTransaction, ServiceRejection, type ServiceResult } from "@/lib/db/transaction";
import { INQUIRY_STATUS_LABELS, type InquiryInput } from "./schema";

/** At most this many inquiries per visitor per window. */
const RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 };

/**
 * A keyed hash of the visitor's IP, so repeat senders can be limited without
 * storing the address itself. Keyed with a server secret so the hash can't be
 * reversed by trying every IP.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.SUPABASE_SECRET_KEY || "growxeno-inquiries";
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/**
 * Saves a website inquiry (public, no sign-in). Returns a rejection the
 * visitor can read when they have sent too many in a short time.
 */
export async function createInquiry(
  input: InquiryInput,
  meta: { ipHash: string | null; userAgent: string | null },
): Promise<ServiceResult<{ id: string }>> {
  if (meta.ipHash) {
    const recent = await prisma.inquiry.count({
      where: { ipHash: meta.ipHash, createdAt: { gte: new Date(Date.now() - RATE_LIMIT.windowMs) } },
    });
    if (recent >= RATE_LIMIT.max) {
      return { ok: false, error: "You've sent a few messages already. Please wait a few minutes, or email us directly." };
    }
  }

  const inquiry = await prisma.inquiry.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      service: input.service,
      message: input.message,
      ipHash: meta.ipHash,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
    select: { id: true },
  });
  return { ok: true, data: inquiry };
}

/** Marks an inquiry New, Contacted or Closed, recording who did it. */
export async function setInquiryStatus(actor: Actor, inquiryId: string, status: InquiryStatus): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const inquiry = await tx.inquiry.findUnique({ where: { id: inquiryId }, select: { name: true, status: true } });
    if (!inquiry) throw new ServiceRejection("That inquiry no longer exists.");
    if (inquiry.status === status) return;

    await tx.inquiry.update({
      where: { id: inquiryId },
      data: { status, handledById: actor.user.id, handledAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "inquiry.status_changed",
      entityType: "Inquiry",
      entityId: inquiryId,
      summary: `Marked the inquiry from ${inquiry.name} as ${INQUIRY_STATUS_LABELS[status]}`,
      previousValue: { status: inquiry.status },
      newValue: { status },
    });
  });
}
