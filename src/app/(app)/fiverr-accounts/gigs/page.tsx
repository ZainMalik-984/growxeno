import type { Metadata } from "next";

import { Breadcrumbs, EmptyState, PageHeader } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { listGigsWithAccounts, listGigStats } from "@/lib/fiverr-accounts/queries";
import { GigStatsPanel } from "./gig-stats-panel";

export const metadata: Metadata = { title: "Gigs" };

/**
 * One page for every active gig: add today's (or any day's) impressions and
 * clicks, and see that gig's own chart — confirmed directly, 2026-09-27.
 * Entirely manual entry, same as Daily Statistics (specification Section 51)
 * — nothing here is fetched from Fiverr.
 */
export default async function GigsPage() {
  const actor = await requirePermission("fiverr_accounts.view");
  const canManage = actor.permissions.has("fiverr_accounts.manage");

  const gigs = await listGigsWithAccounts();
  const withStats = await Promise.all(
    gigs.map(async (gig) => ({ gig, stats: await listGigStats(gig.id) })),
  );

  return (
    <>
      <Breadcrumbs items={[{ label: "Fiverr" }, { label: "Gigs" }]} />
      <PageHeader
        title="Gigs"
        description="Manually entered daily impressions and clicks, one chart per gig. Never fetched from Fiverr."
      />

      {withStats.length === 0 ? (
        <EmptyState
          title="No active gigs yet"
          description="Add a gig from its Fiverr account's page first."
        />
      ) : (
        <div className="space-y-10">
          {withStats.map(({ gig, stats }) => (
            <GigStatsPanel key={gig.id} gig={gig} initialStats={stats} canManage={canManage} />
          ))}
        </div>
      )}
    </>
  );
}
