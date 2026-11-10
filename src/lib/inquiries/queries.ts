import "server-only";

import type { InquiryStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type InquiryRow = {
  id: string;
  name: string;
  email: string;
  service: string | null;
  message: string;
  status: InquiryStatus;
  createdAt: Date;
  handledBy: string | null;
  handledAt: Date | null;
};

export const INQUIRIES_PAGE_SIZE = 20;

const SELECT = {
  id: true,
  name: true,
  email: true,
  service: true,
  message: true,
  status: true,
  createdAt: true,
  handledAt: true,
  handledBy: { select: { fullName: true } },
} as const;

type Raw = { handledBy: { fullName: string } | null } & Omit<InquiryRow, "handledBy">;
const toRow = (row: Raw): InquiryRow => ({ ...row, handledBy: row.handledBy?.fullName ?? null });

export async function listInquiries(filters: { status?: InquiryStatus; search?: string; page: number }): Promise<{
  rows: InquiryRow[];
  total: number;
  pageCount: number;
}> {
  const search = filters.search?.trim();
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { message: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      select: SELECT,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * INQUIRIES_PAGE_SIZE,
      take: INQUIRIES_PAGE_SIZE,
    }),
    prisma.inquiry.count({ where }),
  ]);
  return { rows: rows.map(toRow), total, pageCount: Math.max(1, Math.ceil(total / INQUIRIES_PAGE_SIZE)) };
}

export async function countInquiriesByStatus(): Promise<Record<InquiryStatus, number>> {
  const groups = await prisma.inquiry.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: Record<InquiryStatus, number> = { NEW: 0, CONTACTED: 0, CLOSED: 0 };
  for (const g of groups) counts[g.status] = g._count._all;
  return counts;
}

/** For the dashboard card: the newest unhandled inquiries and how many there are. */
export async function getNewInquiriesSummary(limit = 4): Promise<{ count: number; latest: InquiryRow[] }> {
  const [count, latest] = await Promise.all([
    prisma.inquiry.count({ where: { status: "NEW" } }),
    prisma.inquiry.findMany({ where: { status: "NEW" }, select: SELECT, orderBy: { createdAt: "desc" }, take: limit }),
  ]);
  return { count, latest: latest.map(toRow) };
}
