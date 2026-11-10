import { AlarmClock, BarChart3, Briefcase, ClipboardList, Hourglass, History, Loader, Mail, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { DeadlineCountdown } from "@/components/ui/deadline";
import { buttonVariants } from "@/components/ui/button";
import { CompactEmpty, MetricTile } from "@/components/ui/metric";
import { Breadcrumbs } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-dot";
import { listRoles } from "@/lib/access/queries";
import { requireActor } from "@/lib/auth/authorize";
import { lastNDaysRangeUtc } from "@/lib/daily-stats/date-ranges";
import { getDailyStatsRangeTotals } from "@/lib/daily-stats/queries";
import { getEmployeeCommission, getEmployeeOutputSummary, getEmployeeProfile } from "@/lib/employees/queries";
import { getFiverrFeeSettings } from "@/lib/settings/queries";
import { CommissionCard } from "@/components/finance/commission-card";
import { CLOSED_ORDER_STATUSES, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_LABELS } from "@/lib/orders/state-machine";
import { ITEM_STATUS_TONE, ORDER_STATUS_TONE } from "@/lib/orders/status-tone";
import { ActivityTabs } from "./activity-tabs";
import { EditProfileButton } from "./edit-profile-dialog";

export const metadata: Metadata = { title: "Employee profile" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Employee Profile (specification Section 45; redesigned 2026-11-04).
 *
 * An Employee creates orders and hands the work to External Workers
 * (owner-directed, 2026-11-04), so the page is about their output: orders
 * they created, items they assigned, their activity and their manually
 * entered daily statistics. No earnings section: employees are salaried and
 * never paid per item. Nothing is fabricated.
 */
export default async function EmployeeProfilePage({ params }: PageProps<"/employees/[id]">) {
  const actor = await requireActor();
  const { id } = await params;

  const isSelf = actor.user.id === id;
  const canViewAll = actor.permissions.has("employees.view.all");
  const canViewOwn = actor.permissions.has("employees.view") && isSelf;
  if (!canViewAll && !canViewOwn) {
    redirect("/forbidden?permission=employees.view.all");
  }

  const canEdit = actor.permissions.has("users.edit");
  const canViewDailyStats = actor.permissions.has("daily_stats.view.all") || isSelf;
  const canCreateOrders = isSelf && actor.permissions.has("orders.create");
  // Commission is pay: the person themselves, or someone who manages users or revenue.
  const canViewCommission = isSelf || canEdit || actor.permissions.has("finance.revenue.view");

  // One round of requests: none of these needs another's result.
  const [profile, output, dailyStatsTotals, roles, commission, fiverrFee] = await Promise.all([
    getEmployeeProfile(id),
    getEmployeeOutputSummary(id),
    canViewDailyStats ? getDailyStatsRangeTotals(lastNDaysRangeUtc(30), { mode: "OWN", userId: id }) : Promise.resolve(null),
    canEdit ? listRoles() : Promise.resolve([]),
    canViewCommission ? getEmployeeCommission(id) : Promise.resolve(null),
    canEdit ? getFiverrFeeSettings() : Promise.resolve(null),
  ]);
  if (!profile) notFound();

  const dailyTotals = dailyStatsTotals && dailyStatsTotals.length > 0 ? sumDailyStats(dailyStatsTotals) : null;

  return (
    <>
      <Breadcrumbs items={[{ label: "Workforce" }, { label: "Employees", href: "/employees" }, { label: profile.fullName }]} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Card className="mb-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center rounded-full bg-indigo-50 text-lg font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100"
            >
              {initials(profile.fullName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-zinc-900">{profile.fullName}</h1>
                <StatusBadge tone={profile.isActive ? "done" : "danger"} label={profile.isActive ? "Active" : "Inactive"} />
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-zinc-500">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </span>
                {profile.jobTitle ? (
                  <>
                    <span aria-hidden="true" className="size-1 rounded-full bg-zinc-300" />
                    <span>{profile.jobTitle}</span>
                  </>
                ) : null}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.roleNames.length > 0 ? (
                  profile.roleNames.map((role) => (
                    <span key={role} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200">
                      {role}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-amber-700">No role assigned</span>
                )}
              </div>
            </div>
          </div>

          {canEdit ? (
            <EditProfileButton
              isSelf={isSelf}
              fiverrFeePercent={fiverrFee?.percent ?? 20}
              roles={roles.map((role) => ({ id: role.id, name: role.name, description: role.description }))}
              employee={{
                id: profile.id,
                fullName: profile.fullName,
                displayName: profile.displayName,
                email: profile.email,
                jobTitle: profile.jobTitle,
                phone: profile.phone,
                whatsappNumber: profile.whatsappNumber,
                isActive: profile.isActive,
                roleIds: profile.roles.map((role) => role.id),
                categories: profile.categories.map((c) => c.name),
                commissionPercent: profile.commissionPercent,
              }}
            />
          ) : null}
        </div>
      </Card>

      {/* ── Output overview ────────────────────────────────────────────── */}
      <section aria-label="Orders overview" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile icon={ClipboardList} label="Orders created" value={output.ordersCreated} hint="All time" tone="indigo" />
        <MetricTile icon={Loader} label="Open" value={output.openOrders} hint="Not yet delivered" tone="emerald" />
        <MetricTile
          icon={AlarmClock}
          label="Overdue"
          value={output.overdueOrders}
          hint={output.overdueOrders > 0 ? "Open, past their deadline" : "Nothing late"}
          tone={output.overdueOrders > 0 ? "red" : "zinc"}
          emphasize={output.overdueOrders > 0}
        />
        <MetricTile
          icon={Hourglass}
          label="Awaiting acceptance"
          value={output.awaitingAcceptance}
          hint="Assigned, not yet accepted"
          tone="amber"
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          <Card className="p-5 sm:p-6">
            <CardHeader
              icon={ClipboardList}
              tone="indigo"
              title="Recent orders"
              description="Orders this person created, newest first."
              actions={
                canCreateOrders ? (
                  <Link href="/orders/new" className={buttonVariants({ variant: "secondary", size: "sm", className: "rounded-[8px]" })}>
                    <Plus aria-hidden="true" />
                    New order
                  </Link>
                ) : undefined
              }
            />
            {output.recentOrders.length === 0 ? (
              <CompactEmpty icon={ClipboardList} title="No orders yet" description="Orders this person creates will be listed here." />
            ) : (
              <ul className="-mt-2 divide-y divide-zinc-100">
                {output.recentOrders.map((order) => {
                  const open = !CLOSED_ORDER_STATUSES.includes(order.status);
                  return (
                    <li key={order.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/orders/${order.id}`} className="text-[13px] font-semibold tabular-nums text-zinc-900 hover:text-indigo-600 hover:underline">
                          #{order.orderNumber}
                        </Link>
                        <span className="ml-2 text-xs text-zinc-500">
                          {order.itemCount} {order.itemCount === 1 ? "item" : "items"} · created {dayFormat.format(order.createdAt)}
                        </span>
                      </div>
                      <span className="flex shrink-0 items-center gap-3">
                        {order.deadline ? <DeadlineCountdown deadline={order.deadline} finished={!open} showDate={false} /> : null}
                        <StatusBadge tone={ORDER_STATUS_TONE[order.status]} label={ORDER_STATUS_LABELS[order.status]} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <CardHeader icon={History} tone="indigo" title="Activity" description="What this person did, and the work they handed out." />
            <ActivityTabs
              activity={profile.activity.map((entry) => ({
                id: entry.id,
                summary: entry.summary,
                when: `${dateFormat.format(entry.createdAt)} UTC`,
              }))}
              assignments={output.recentAssignments.map((item) => ({
                id: item.itemId,
                orderId: item.orderId,
                orderNumber: item.orderNumber,
                serviceName: item.serviceName,
                workerName: item.workerName,
                statusLabel: ORDER_ITEM_STATUS_LABELS[item.status],
                statusTone: ITEM_STATUS_TONE[item.status],
                when: item.assignedAt ? `${dateFormat.format(item.assignedAt)} UTC` : null,
              }))}
            />
          </Card>
        </div>

        {/* ── Side column ─────────────────────────────────────────────── */}
        <aside className="min-w-0 space-y-6">
          <Card className="p-5 sm:p-6">
            <CardHeader icon={Briefcase} tone="indigo" title="Profile" />
            <dl className="-mt-2 grid grid-cols-1 gap-x-6 gap-y-3.5 text-[13px] sm:grid-cols-2 xl:grid-cols-1">
              <Detail label="Email" value={<span className="break-all">{profile.email}</span>} />
              <Detail label="Phone" value={profile.phone} />
              <Detail label="WhatsApp" value={profile.whatsappNumber} />
              <Detail label="Display name" value={profile.displayName} />
              <Detail label="Roles" value={profile.roleNames.length > 0 ? profile.roleNames.join(", ") : null} empty="None assigned" />
              <Detail label="Account status" value={profile.isActive ? "Active" : "Inactive"} />
              <Detail
                label="Categories / services"
                value={profile.categories.length > 0 ? profile.categories.map((c) => c.name).join(", ") : null}
                empty="No orders yet"
              />
              {canViewCommission ? (
                <Detail label="Commission" value={profile.commissionPercent !== null ? `${profile.commissionPercent}%` : null} empty="Not set" />
              ) : null}
              <Detail label="Member since" value={dayFormat.format(profile.createdAt)} />
              <Detail label="Last sign-in" value={profile.lastLoginAt ? `${dateFormat.format(profile.lastLoginAt)} UTC` : null} empty="Never" />
            </dl>
          </Card>

          {/* Shown only when a commission percentage is set (2026-11-04). */}
          {commission ? <CommissionCard commission={commission} /> : null}

          {canViewDailyStats ? (
            <Card className="p-5 sm:p-6">
              <CardHeader
                icon={BarChart3}
                tone="amber"
                title="Daily statistics"
                description="Last 30 days, entered by hand."
                actions={
                  <Link href={`/daily-stats?user=${id}`} className="text-[13px] font-medium text-indigo-600 hover:underline">
                    Full history
                  </Link>
                }
              />
              {dailyTotals ? (
                <dl className="-mt-2 grid grid-cols-2 gap-2.5">
                  <StatCell label="Orders" value={dailyTotals.orders} />
                  <StatCell label="Completed" value={dailyTotals.completed} />
                  <StatCell label="Pending" value={dailyTotals.pending} />
                  <StatCell label="Revenue" value={dailyTotals.revenue || "0"} />
                </dl>
              ) : (
                <CompactEmpty
                  icon={BarChart3}
                  title="No entries in the last 30 days"
                  description="Daily figures appear here once they're entered."
                  action={
                    <Link href={`/daily-stats?user=${id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                      Open
                    </Link>
                  }
                />
              )}
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Detail({ label, value, empty = "—" }: { label: string; value: ReactNode; empty?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-zinc-900">{value ?? <span className="font-normal text-zinc-400">{empty}</span>}</dd>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] bg-zinc-50 px-3.5 py-2.5 ring-1 ring-inset ring-zinc-200/70">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words text-base font-semibold tabular-nums text-zinc-900">{value}</dd>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Same totals the page showed before the redesign: summed counts, revenue per currency (never blended). */
function sumDailyStats(
  days: ReadonlyArray<{ orders: number; completed: number; pending: number; revenueByCurrency: Record<string, number> }>,
) {
  const revenue: Record<string, number> = {};
  for (const day of days) {
    for (const [currency, amount] of Object.entries(day.revenueByCurrency)) revenue[currency] = (revenue[currency] ?? 0) + amount;
  }
  return {
    orders: days.reduce((sum, day) => sum + day.orders, 0),
    completed: days.reduce((sum, day) => sum + day.completed, 0),
    pending: days.reduce((sum, day) => sum + day.pending, 0),
    revenue: Object.entries(revenue)
      .map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`)
      .join(" · "),
  };
}
