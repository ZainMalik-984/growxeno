import "server-only";

import type { Actor } from "@/lib/auth/session";
import { runTransaction, ServiceRejection, type ServiceResult, type TransactionClient } from "@/lib/db/transaction";
import { isAssignedToIdentity } from "@/lib/orders/assignment";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { amountProblem, clampDone, markShare, type TeamShareStatus } from "./rules";

/**
 * An outsourced worker's own team (owner request, 2026-11-17). Every function
 * acts only for the signed-in worker: members are always theirs
 * (`outsourcedWorkerId = actor.outsourcedWorkerId`), and shares only on items
 * currently assigned to them. Anything else reads as "not found", so nothing
 * reveals another worker's data. Private by design: no audit entries (the
 * audit log is visible to administrators) and no admin screen reads these
 * tables.
 */

const NOT_FOUND = "That's no longer available. Refresh and try again.";

function ownerOf(actor: Actor): string {
  if (!actor.outsourcedWorkerId) throw new ServiceRejection("Only outsourced workers have a team.");
  return actor.outsourcedWorkerId;
}

function cleanNumber(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (!/\d/.test(v)) throw new ServiceRejection("Enter a WhatsApp number with digits, e.g. +92 300 1234567.");
  return v;
}

async function ownMember(tx: TransactionClient, ownerId: string, memberId: string) {
  const member = await tx.teamMember.findFirst({ where: { id: memberId, outsourcedWorkerId: ownerId }, select: { id: true, isActive: true } });
  if (!member) throw new ServiceRejection(NOT_FOUND);
  return member;
}

/** The item, only while it is assigned to this worker, with the shares already on it. */
async function ownItem(tx: TransactionClient, actor: Actor, ownerId: string, itemId: string) {
  const item = await tx.orderItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      workerId: true,
      outsourcedWorkerId: true,
      startingCount: true,
      targetCount: true,
      service: { select: { metricType: true } },
      teamShares: { where: { teamMember: { outsourcedWorkerId: ownerId } }, select: { id: true, amount: true } },
    },
  });
  if (!item || !isAssignedToIdentity(item, { userId: actor.user.id, outsourcedWorkerId: ownerId })) throw new ServiceRejection(NOT_FOUND);
  return { ...item, metricType: (item.service.metricType ?? null) as ServiceMetricType | null };
}

async function ownShare(tx: TransactionClient, actor: Actor, ownerId: string, shareId: string) {
  const share = await tx.teamShare.findFirst({
    where: { id: shareId, teamMember: { outsourcedWorkerId: ownerId } },
    select: { id: true, orderItemId: true, amount: true, status: true },
  });
  if (!share) throw new ServiceRejection(NOT_FOUND);
  const item = await ownItem(tx, actor, ownerId, share.orderItemId);
  return { share, item };
}

// ---------- members ----------

export type MemberInput = { name: string; whatsappNumber?: string | null };

export async function addTeamMember(actor: Actor, input: MemberInput): Promise<ServiceResult<{ id: string }>> {
  return runTransaction(async (tx) => {
    const ownerId = ownerOf(actor);
    const member = await tx.teamMember.create({
      data: { outsourcedWorkerId: ownerId, name: input.name.trim(), whatsappNumber: cleanNumber(input.whatsappNumber) },
      select: { id: true },
    });
    return member;
  });
}

export async function updateTeamMember(actor: Actor, memberId: string, input: MemberInput): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const ownerId = ownerOf(actor);
    await ownMember(tx, ownerId, memberId);
    await tx.teamMember.update({ where: { id: memberId }, data: { name: input.name.trim(), whatsappNumber: cleanNumber(input.whatsappNumber) } });
  });
}

/** Deactivating keeps the member's past work; their open shares stay until finished or removed. */
export async function setTeamMemberActive(actor: Actor, memberId: string, isActive: boolean): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const ownerId = ownerOf(actor);
    await ownMember(tx, ownerId, memberId);
    await tx.teamMember.update({ where: { id: memberId }, data: { isActive } });
  });
}

// ---------- shares ----------

export type AssignShareInput = { itemId: string; memberId: string; amount: number | null; note?: string | null };

export async function assignShare(actor: Actor, input: AssignShareInput): Promise<ServiceResult<{ id: string }>> {
  return runTransaction(async (tx) => {
    const ownerId = ownerOf(actor);
    const member = await ownMember(tx, ownerId, input.memberId);
    if (!member.isActive) throw new ServiceRejection("That member is inactive. Reactivate them on My team first.");
    const item = await ownItem(tx, actor, ownerId, input.itemId);
    const problem = amountProblem(item, item.teamShares, input.amount);
    if (problem) throw new ServiceRejection(problem);

    // A member may take several parts of one task (2026-11-17), so no duplicate check.
    return tx.teamShare.create({
      data: { orderItemId: item.id, teamMemberId: member.id, amount: input.amount, note: input.note?.trim() || null, status: "PROCESSING" },
      select: { id: true },
    });
  });
}

export type UpdateShareInput = { shareId: string; amount?: number | null; done?: number; note?: string | null };

export async function updateShare(actor: Actor, input: UpdateShareInput): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const ownerId = ownerOf(actor);
    const { share, item } = await ownShare(tx, actor, ownerId, input.shareId);
    const amount = input.amount === undefined ? share.amount : input.amount;
    if (input.amount !== undefined) {
      const problem = amountProblem(item, item.teamShares, amount, share.id);
      if (problem) throw new ServiceRejection(problem);
    }
    await tx.teamShare.update({
      where: { id: share.id },
      data: {
        ...(input.amount !== undefined ? { amount } : {}),
        ...(input.done !== undefined ? { done: clampDone(input.done, amount) } : {}),
        ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
      },
    });
  });
}

/** Mark done (stamps the finish time) or reopen. */
export async function setShareStatus(actor: Actor, shareId: string, status: TeamShareStatus, now = new Date()): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const ownerId = ownerOf(actor);
    const { share } = await ownShare(tx, actor, ownerId, shareId);
    const next = markShare(status, now);
    await tx.teamShare.update({
      where: { id: share.id },
      // Marking done with an amount fills the progress to it, so the numbers agree.
      data: { ...next, ...(status === "DONE" && share.amount !== null ? { done: share.amount } : {}) },
    });
  });
}

export async function removeShare(actor: Actor, shareId: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const ownerId = ownerOf(actor);
    const { share } = await ownShare(tx, actor, ownerId, shareId);
    await tx.teamShare.delete({ where: { id: share.id } });
  });
}

/**
 * When an item is taken away from its worker (reassigned, rejected, or its
 * remainder moved on), that worker's private split of it goes too. Called
 * inside the orders service's own transactions.
 */
export async function clearTeamShares(tx: TransactionClient, itemId: string, keepForWorkerId: string | null = null): Promise<void> {
  await tx.teamShare.deleteMany({
    where: { orderItemId: itemId, ...(keepForWorkerId ? { teamMember: { outsourcedWorkerId: { not: keepForWorkerId } } } : {}) },
  });
}
