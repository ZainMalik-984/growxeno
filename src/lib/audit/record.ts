import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Audit writing.
 *
 * Always called with a transaction client so the audit row and the change it
 * describes commit or roll back together. An audit trail that can disagree with
 * the data it describes is worse than none.
 *
 * There is intentionally no update or delete helper here (specification
 * Section 64: audit history must not be casually editable).
 */

export type AuditEntry = {
  readonly actorUserId: string | null;
  readonly actorEmail: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly summary: string;
  readonly previousValue?: Prisma.InputJsonValue;
  readonly newValue?: Prisma.InputJsonValue;
};

/** Minimal surface we need from a Prisma transaction client. */
type AuditWriter = {
  auditLog: {
    create(args: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
};

export async function recordAudit(tx: AuditWriter, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      actorEmail: entry.actorEmail,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      ...(entry.previousValue !== undefined ? { previousValue: entry.previousValue } : {}),
      ...(entry.newValue !== undefined ? { newValue: entry.newValue } : {}),
    },
  });
}
