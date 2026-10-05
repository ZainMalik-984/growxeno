import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Breadcrumbs, MetaList, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { requireActor } from "@/lib/auth/authorize";
import { lastNDaysRangeUtc } from "@/lib/daily-stats/date-ranges";
import { getDailyStatsRangeTotals } from "@/lib/daily-stats/queries";
import { formatCurrencyBreakdown } from "@/lib/finance/money";
import { getWorkerEarnings } from "@/lib/finance/queries";
import { getMyWorkSummary, getWorkerProfile } from "@/lib/workers/queries";

export const metadata: Metadata = { title: "Worker profile" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/**
 * Worker Profile (specification Section 45).
 *
 * Only what has a real data source today: identity, roles, categories/
 * services actually worked on, active/pending/completed work, this worker's
 * own activity, manually entered daily statistics (Phase 6), and earnings
 * (Phase 7). Performance is still named but marked "not available yet" — no
 * operational metric has been decided — rather than fabricated.
 */
export default async function WorkerProfilePage({ params }: PageProps<"/workers/[id]">) {
  const actor = await requireActor();
  const { id } = await params;

  const canViewAll = actor.permissions.has("workers.view.all");
  const canViewOwn = actor.permissions.has("workers.view") && actor.user.id === id;
  if (!canViewAll && !canViewOwn) {
    redirect("/forbidden?permission=workers.view.all");
  }

  const profile = await getWorkerProfile(id);
  if (!profile) notFound();

  const canViewDailyStats = actor.permissions.has("daily_stats.view.all") || actor.user.id === id;
  // finance.worker_payments.view has no `.all` scope pair — a worker seeing
  // their OWN earnings is a baseline right, same pattern as daily stats
  // above, not a permission escalation.
  const canViewEarnings = actor.permissions.has("finance.worker_payments.view") || actor.user.id === id;

  const [summary, dailyStatsTotals, earnings] = await Promise.all([
    getMyWorkSummary(id),
    canViewDailyStats ? getDailyStatsRangeTotals(lastNDaysRangeUtc(30), { mode: "OWN", userId: id }) : Promise.resolve(null),
    canViewEarnings ? getWorkerEarnings({ workerId: id }) : Promise.resolve(null),
  ]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Workforce" }, { label: "Workers", href: "/workers" }, { label: profile.fullName }]} />
      <PageHeader
        title={profile.fullName}
        description={profile.jobTitle ?? undefined}
      />

      <Section title="Profile">
        <MetaList
          items={[
            { label: "Email", value: profile.email },
            {
              label: "Roles",
              value: profile.roleNames.length > 0 ? profile.roleNames.join(", ") : <span className="text-ink-faint">None assigned</span>,
            },
            {
              label: "Status",
              value: <StatusDot tone={profile.isActive ? "done" : "danger"} label={profile.isActive ? "Active" : "Inactive"} />,
            },
            {
              label: "Categories / services",
              value:
                profile.categories.length > 0 ? (
                  profile.categories.map((c) => c.name).join(", ")
                ) : (
                  <span className="text-ink-faint">No completed work yet</span>
                ),
            },
          ]}
        />
      </Section>

      <Section title="Work">
        <MetaList
          items={[
            { label: "New", value: summary.newCount },
            { label: "Active", value: summary.activeCount },
            { label: "Due today", value: summary.dueTodayCount },
            { label: "Overdue", value: summary.overdueCount },
          ]}
        />

        {summary.attention.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {summary.attention.map((item) => (
              <li key={item.itemId} className="flex items-center justify-between gap-3 text-[13px]">
                <Link href={`/orders/${item.orderId}`} className="min-w-0 truncate text-ink hover:underline">
                  #{item.orderNumber} · {item.serviceName}
                </Link>
                <span className={item.isOverdue ? "shrink-0 text-red-600" : "shrink-0 text-ink-muted"}>
                  {item.statusLabel}
                  {item.deadline ? ` · ${dateFormat.format(item.deadline)} UTC` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-ink-faint">No open work assigned.</p>
        )}
      </Section>

      <Section title="Recently completed">
        {summary.recentlyCompleted.length === 0 ? (
          <p className="text-[13px] text-ink-faint">Nothing completed yet.</p>
        ) : (
          <ul className="space-y-2">
            {summary.recentlyCompleted.map((item) => (
              <li key={item.itemId} className="flex items-center justify-between gap-3 text-[13px]">
                <Link href={`/orders/${item.orderId}`} className="min-w-0 truncate text-ink hover:underline">
                  #{item.orderNumber} · {item.serviceName}
                </Link>
                <span className="shrink-0 text-ink-faint">{dateFormat.format(item.completedAt)} UTC</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Activity">
        {profile.activity.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {profile.activity.map((entry) => (
              <li key={entry.id} className="text-[13px] text-ink-muted">
                <span className="text-ink">{entry.summary}</span>
                <span className="text-ink-faint"> · {dateFormat.format(entry.createdAt)} UTC</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {canViewDailyStats ? (
        <Section
          title="Daily statistics (last 30 days)"
          description="Manually entered — never inferred from orders."
          actions={
            <Link href={`/daily-stats?user=${id}`} className="text-[13px] text-ink-muted hover:text-ink hover:underline">
              Full history
            </Link>
          }
        >
          {dailyStatsTotals && dailyStatsTotals.length > 0 ? (
            <MetaList
              items={[
                { label: "Orders", value: dailyStatsTotals.reduce((sum, day) => sum + day.orders, 0) },
                { label: "Completed", value: dailyStatsTotals.reduce((sum, day) => sum + day.completed, 0) },
                { label: "Pending", value: dailyStatsTotals.reduce((sum, day) => sum + day.pending, 0) },
                {
                  label: "Revenue",
                  value: Object.entries(
                    dailyStatsTotals.reduce<Record<string, number>>((totals, day) => {
                      for (const [currency, amount] of Object.entries(day.revenueByCurrency)) {
                        totals[currency] = (totals[currency] ?? 0) + amount;
                      }
                      return totals;
                    }, {}),
                  )
                    .map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`)
                    .join(" · ") || "0",
                },
              ]}
            />
          ) : (
            <p className="text-[13px] text-ink-faint">No entries in the last 30 days.</p>
          )}
        </Section>
      ) : null}

      {canViewEarnings && earnings ? (
        <Section
          title="Earnings"
          description="Earned from completed (or partially completed, adjusted) items — never a stored balance."
          actions={
            actor.permissions.has("finance.worker_payments.view") ? (
              <Link href="/finance/worker-payments" className="text-[13px] text-ink-muted hover:text-ink hover:underline">
                All payments
              </Link>
            ) : undefined
          }
        >
          <MetaList
            items={[
              { label: "Earned", value: formatCurrencyBreakdown(earnings.earnedByCurrency) },
              { label: "Paid", value: formatCurrencyBreakdown(earnings.paidByCurrency) },
              { label: "Outstanding", value: formatCurrencyBreakdown(earnings.outstandingByCurrency) },
            ]}
          />
        </Section>
      ) : null}

      <Section title="Not available yet">
        <p className="max-w-2xl text-[13px] text-ink-muted">
          Performance figures are not shown here yet — no operational metric has been decided
          (docs/REQUIREMENTS.md). Showing one now would mean fabricating it.
        </p>
      </Section>
    </>
  );
}
