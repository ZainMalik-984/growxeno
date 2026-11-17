import "server-only";

import type { Actor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { serviceLabel } from "@/lib/services/label";
import type { TeamShareStatus } from "./rules";

/**
 * Reads for an outsourced worker's own team (2026-11-17). Always scoped to the
 * signed-in worker, and shares only on items still assigned to them. Dates go
 * to the client as ISO strings.
 */

export type TeamMemberView = {
  id: string;
  name: string;
  whatsappNumber: string | null;
  isActive: boolean;
  processing: number;
  done: number;
};

export type TeamShareView = {
  id: string;
  memberId: string;
  memberName: string;
  memberWhatsapp: string | null;
  amount: number | null;
  done: number;
  status: TeamShareStatus;
  note: string | null;
  assignedAt: string;
  finishedAt: string | null;
};

/** A share with the task it belongs to, for a member's work popup. */
export type MemberShareView = TeamShareView & {
  itemId: string;
  orderNumber: number;
  serviceName: string;
  metricType: ServiceMetricType | null;
  channelLink: string | null;
  startingCount: number | null;
  targetCount: number | null;
};

const shareSelect = {
  id: true,
  amount: true,
  done: true,
  status: true,
  note: true,
  assignedAt: true,
  finishedAt: true,
  teamMember: { select: { id: true, name: true, whatsappNumber: true } },
} as const;

type ShareRow = {
  id: string;
  amount: number | null;
  done: number;
  status: TeamShareStatus;
  note: string | null;
  assignedAt: Date;
  finishedAt: Date | null;
  teamMember: { id: string; name: string; whatsappNumber: string | null };
};

function toShareView(s: ShareRow): TeamShareView {
  return {
    id: s.id,
    memberId: s.teamMember.id,
    memberName: s.teamMember.name,
    memberWhatsapp: s.teamMember.whatsappNumber,
    amount: s.amount,
    done: s.done,
    status: s.status,
    note: s.note,
    assignedAt: s.assignedAt.toISOString(),
    finishedAt: s.finishedAt?.toISOString() ?? null,
  };
}

/** Shares on items still assigned to this worker. */
const liveShareWhere = (ownerId: string) => ({ teamMember: { outsourcedWorkerId: ownerId }, orderItem: { outsourcedWorkerId: ownerId } });

/** The worker's team, active first, with how many shares each has processing and done. */
export async function listTeam(actor: Actor): Promise<TeamMemberView[]> {
  const ownerId = actor.outsourcedWorkerId;
  if (!ownerId) return [];
  const [members, counts] = await Promise.all([
    prisma.teamMember.findMany({
      where: { outsourcedWorkerId: ownerId },
      select: { id: true, name: true, whatsappNumber: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.teamShare.groupBy({ by: ["teamMemberId", "status"], where: liveShareWhere(ownerId), _count: { _all: true } }),
  ]);
  const count = (memberId: string, status: TeamShareStatus) => counts.find((c) => c.teamMemberId === memberId && c.status === status)?._count._all ?? 0;
  return members.map((m) => ({ ...m, processing: count(m.id, "PROCESSING"), done: count(m.id, "DONE") }));
}

/** One member's shares, processing first, then the most recently finished. */
export async function memberWork(actor: Actor, memberId: string): Promise<MemberShareView[] | null> {
  const ownerId = actor.outsourcedWorkerId;
  if (!ownerId) return null;
  const member = await prisma.teamMember.findFirst({ where: { id: memberId, outsourcedWorkerId: ownerId }, select: { id: true } });
  if (!member) return null;
  const shares = await prisma.teamShare.findMany({
    where: { teamMemberId: memberId, ...liveShareWhere(ownerId) },
    select: {
      ...shareSelect,
      orderItem: {
        select: {
          id: true,
          channelLink: true,
          startingCount: true,
          targetCount: true,
          order: { select: { orderNumber: true } },
          service: { select: { name: true, metricType: true } },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { finishedAt: "desc" }, { assignedAt: "desc" }],
    take: 200,
  });
  return shares.map((s) => ({
    ...toShareView(s),
    itemId: s.orderItem.id,
    orderNumber: s.orderItem.order.orderNumber,
    serviceName: serviceLabel(s.orderItem.service.name, s.orderItem.category.name),
    metricType: (s.orderItem.service.metricType ?? null) as ServiceMetricType | null,
    channelLink: s.orderItem.channelLink,
    startingCount: s.orderItem.startingCount,
    targetCount: s.orderItem.targetCount,
  }));
}

/** Shares on the given tasks, keyed by item id, for the Orders page's Team popups. */
export async function sharesForItems(actor: Actor, itemIds: readonly string[]): Promise<Record<string, TeamShareView[]>> {
  const ownerId = actor.outsourcedWorkerId;
  const out: Record<string, TeamShareView[]> = {};
  if (!ownerId || itemIds.length === 0) return out;
  const shares = await prisma.teamShare.findMany({
    where: { orderItemId: { in: [...itemIds] }, ...liveShareWhere(ownerId) },
    select: { ...shareSelect, orderItemId: true },
    orderBy: { assignedAt: "asc" },
  });
  for (const s of shares) (out[s.orderItemId] ??= []).push(toShareView(s));
  return out;
}

/** Active members, for the assign picker. */
export async function activeMembers(actor: Actor): Promise<{ id: string; name: string; whatsappNumber: string | null }[]> {
  const ownerId = actor.outsourcedWorkerId;
  if (!ownerId) return [];
  return prisma.teamMember.findMany({
    where: { outsourcedWorkerId: ownerId, isActive: true },
    select: { id: true, name: true, whatsappNumber: true },
    orderBy: { name: "asc" },
  });
}
