import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireScope } from "@/lib/auth/authorize";
import { resolveStatsRange, type RangePreset } from "@/lib/daily-stats/date-ranges";
import {
  DAILY_STATS_PAGE_SIZE,
  getDailyStatsRangeTotals,
  getDailyStatsUserTotals,
  listDailyStats,
  listDailyStatsForDate,
  MAX_PAGE_SIZE,
  type DailyStatScope,
} from "@/lib/daily-stats/queries";
import { listAssignableWorkers } from "@/lib/orders/queries";
import { BulkEntryForm } from "./bulk-entry-form";
import { DailyStatsCharts } from "./daily-stats-charts";
import { DailyStatsFilterBar } from "./daily-stats-filter-bar";
import { DailyStatForm, EditDailyStatButton } from "./daily-stat-form";
import { DeleteDailyStatButton } from "./daily-stat-delete-button";

export const metadata: Metadata = { title: "Daily Statistics" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

const searchParamsSchema = z.object({
  user: z.uuid().optional(),
  range: z.enum(["today", "7d", "30d", "90d", "custom"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  bulkDate: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DAILY_STATS_PAGE_SIZE),
});

export default async function DailyStatsPage({ searchParams }: PageProps<"/daily-stats">) {
  const { actor, scope } = await requireScope("daily_stats.view");
  const raw = await searchParams;
  const params = searchParamsSchema.parse(raw);

  const statScope: DailyStatScope = scope === "ALL" ? { mode: "ALL" } : { mode: "OWN", userId: actor.user.id };
  const range = resolveStatsRange(params.range as RangePreset | undefined, { from: params.from, to: params.to });

  const canCreate = actor.permissions.has("daily_stats.create");
  const canEdit = actor.permissions.has("daily_stats.edit");
  const canDelete = actor.permissions.has("daily_stats.delete");
  const canExport = actor.permissions.has("daily_stats.export");
  const canViewAll = scope === "ALL";

  const bulkDate = params.bulkDate ? new Date(`${params.bulkDate}T00:00:00.000Z`) : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

  const [result, users, rangeTotals, userTotals, bulkExisting] = await Promise.all([
    listDailyStats(
      { page: params.page, pageSize: params.size, userId: params.user, dateFrom: range.start, dateTo: range.end },
      statScope,
    ),
    canViewAll ? listAssignableWorkers() : Promise.resolve([]),
    getDailyStatsRangeTotals(range, statScope),
    canViewAll ? getDailyStatsUserTotals(range, statScope) : Promise.resolve([]),
    canCreate && canViewAll ? listDailyStatsForDate(bulkDate, statScope) : Promise.resolve(new Map()),
  ]);

  const userOptions = users.map((u) => ({ id: u.id, label: u.fullName }));

  const buildHref = (target: number) => {
    const url = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      url.set(key, String(value));
    }
    if (target > 1) url.set("page", String(target));
    const search = url.toString();
    return search ? `/daily-stats?${search}` : "/daily-stats";
  };

  const exportHref = (() => {
    const url = new URLSearchParams();
    if (params.user) url.set("user", params.user);
    url.set("from", range.start.toISOString().slice(0, 10));
    url.set("to", new Date(range.end.getTime() - 1).toISOString().slice(0, 10));
    return `/daily-stats/export?${url.toString()}`;
  })();

  return (
    <>
      <Breadcrumbs items={[{ label: "Workforce" }, { label: "Daily Statistics" }]} />
      <PageHeader
        title="Daily Statistics"
        description={
          canViewAll
            ? "Manually entered, per user per day — never inferred from orders."
            : "Your own manually entered daily statistics."
        }
        actions={
          <div className="flex items-center gap-3">
            {canExport ? (
              <a href={exportHref} className="text-[13px] text-ink-muted hover:text-ink hover:underline">
                Export CSV
              </a>
            ) : null}
            <DailyStatForm users={userOptions.length > 0 ? userOptions : [{ id: actor.user.id, label: actor.user.fullName }]} canCreate={canCreate} />
          </div>
        }
      />

      <DailyStatsFilterBar users={userOptions} showUserFilter={canViewAll} />

      <Section title="Overview" description="Every chart answers an operational question — nothing here is decorative.">
        <DailyStatsCharts totals={rangeTotals} />
      </Section>

      {canViewAll && userTotals.length > 0 ? (
        <Section title="By user">
          <TableWrap>
            <Table>
              <caption className="sr-only">Totals by user</caption>
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH className="text-right">Orders</TH>
                  <TH className="text-right">Completed</TH>
                  <TH className="text-right">Pending</TH>
                  <TH className="text-right">Revenue</TH>
                </TR>
              </THead>
              <TBody>
                {userTotals.map((user) => (
                  <TR key={user.userId}>
                    <TD className="font-medium text-ink">{user.userName}</TD>
                    <TD className="text-right text-ink-muted">{user.orders}</TD>
                    <TD className="text-right text-ink-muted">{user.completed}</TD>
                    <TD className="text-right text-ink-muted">{user.pending}</TD>
                    <TD className="text-right text-ink-muted">
                      {Object.entries(user.revenueByCurrency)
                        .map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`)
                        .join(" · ") || "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Section>
      ) : null}

      <Section title="Entries">
        {result.rows.length === 0 ? (
          <EmptyState title="No entries in this range" description="Add an entry, or widen the date range." />
        ) : (
          <>
            <TableWrap>
              <Table>
                <caption className="sr-only">Daily statistics entries</caption>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    {canViewAll ? <TH>User</TH> : null}
                    <TH className="text-right">Orders</TH>
                    <TH className="text-right">Completed</TH>
                    <TH className="text-right">Pending</TH>
                    <TH className="text-right">Revenue</TH>
                    {canEdit || canDelete ? <TH /> : null}
                  </TR>
                </THead>
                <TBody>
                  {result.rows.map((row) => (
                    <TR key={row.id}>
                      <TD className="text-ink-muted">{dateFormat.format(row.statDate)}</TD>
                      {canViewAll ? <TD className="font-medium text-ink">{row.userName}</TD> : null}
                      <TD className="text-right text-ink-muted">{row.orders}</TD>
                      <TD className="text-right text-ink-muted">{row.completed}</TD>
                      <TD className="text-right text-ink-muted">{row.pending}</TD>
                      <TD className="text-right text-ink-muted">
                        {row.revenue} {row.revenueCurrency}
                      </TD>
                      {canEdit || canDelete ? (
                        <TD>
                          <div className="flex justify-end gap-2">
                            {canEdit ? <EditDailyStatButton row={row} users={userOptions} /> : null}
                            {canDelete ? <DeleteDailyStatButton id={row.id} /> : null}
                          </div>
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              itemLabel="entry"
              buildHref={buildHref}
            />
          </>
        )}
      </Section>

      {canCreate && canViewAll ? (
        <Section
          title="Bulk entry"
          description="Enter every user's numbers for one date at once, instead of one page each."
        >
          <BulkEntryForm users={userOptions} existing={bulkExisting} />
        </Section>
      ) : null}

      {!canViewAll ? (
        <Section title="Not available yet">
          <p className="max-w-2xl text-[13px] text-ink-muted">
            <Link href="/dashboard" className="text-ink hover:underline">
              Your work
            </Link>{" "}
            on the dashboard shows what you have assigned right now — this page is a historical record
            of manually entered counts, not a live view of your orders.
          </p>
        </Section>
      ) : null}
    </>
  );
}
