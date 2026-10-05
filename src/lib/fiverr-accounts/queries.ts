import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Read queries for Fiverr accounts, gigs, and gig daily stats.
 *
 * The PayPal password is never selected here — decrypting it is a separate,
 * explicit action gated on `fiverr_accounts.credentials.view` (service.ts),
 * never part of a list/detail payload. See prisma/schema/fiverr.prisma.
 */

export type FiverrAccountListRow = {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  gigCount: number;
};

export async function listFiverrAccounts(includeInactive = true): Promise<FiverrAccountListRow[]> {
  const accounts = await prisma.fiverrAccount.findMany({
    where: includeInactive ? {} : { isActive: true },
    select: { id: true, name: true, email: true, isActive: true, _count: { select: { gigs: true } } },
    orderBy: { name: "asc" },
  });
  return accounts.map((a) => ({ id: a.id, name: a.name, email: a.email, isActive: a.isActive, gigCount: a._count.gigs }));
}

export async function listAssignableFiverrAccounts(): Promise<Array<{ id: string; name: string }>> {
  return prisma.fiverrAccount.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type FiverrAccountDetail = {
  id: string;
  name: string;
  email: string | null;
  paypalEmail: string | null;
  /** Whether a PayPal password has been saved — never the value itself. */
  hasPaypalPassword: boolean;
  isActive: boolean;
  createdAt: Date;
  gigs: Array<{ id: string; name: string; isActive: boolean }>;
};

export async function getFiverrAccountDetail(id: string): Promise<FiverrAccountDetail | null> {
  const account = await prisma.fiverrAccount.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      paypalEmail: true,
      paypalPasswordEncrypted: true,
      isActive: true,
      createdAt: true,
      gigs: { select: { id: true, name: true, isActive: true }, orderBy: { name: "asc" } },
    },
  });
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    paypalEmail: account.paypalEmail,
    hasPaypalPassword: account.paypalPasswordEncrypted !== null,
    isActive: account.isActive,
    createdAt: account.createdAt,
    gigs: account.gigs,
  };
}

export type GigWithAccount = {
  id: string;
  name: string;
  isActive: boolean;
  fiverrAccountId: string;
  fiverrAccountName: string;
};

/** Every gig across every account — feeds the single Gigs page (one entry form + one chart per gig). */
export async function listGigsWithAccounts(includeInactive = false): Promise<GigWithAccount[]> {
  const gigs = await prisma.fiverrGig.findMany({
    where: includeInactive ? {} : { isActive: true, fiverrAccount: { isActive: true } },
    select: { id: true, name: true, isActive: true, fiverrAccountId: true, fiverrAccount: { select: { name: true } } },
    orderBy: [{ fiverrAccount: { name: "asc" } }, { name: "asc" }],
  });
  return gigs.map((g) => ({ id: g.id, name: g.name, isActive: g.isActive, fiverrAccountId: g.fiverrAccountId, fiverrAccountName: g.fiverrAccount.name }));
}

export type GigStatRow = { id: string; date: string; impressions: number; clicks: number };

export async function listGigStats(gigId: string, limit = 90): Promise<GigStatRow[]> {
  const rows = await prisma.fiverrGigStat.findMany({
    where: { gigId },
    select: { id: true, statDate: true, impressions: true, clicks: true },
    orderBy: { statDate: "desc" },
    take: limit,
  });
  return rows
    .map((r) => ({ id: r.id, date: r.statDate.toISOString().slice(0, 10), impressions: r.impressions, clicks: r.clicks }))
    .reverse();
}
