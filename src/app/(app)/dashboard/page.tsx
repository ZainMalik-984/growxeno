import type { Metadata } from "next";
import { ITEM_STATUS_TONE } from "@/lib/orders/status-tone";
import { DeadlineCountdown } from "@/components/ui/deadline";
import Link from "next/link";
import {
  AlarmClock,
  ArrowUpRight,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  Inbox,
  KeyRound,
  type LucideIcon,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { StatusBadge, StatusDot } from "@/components/ui/status-dot";
import { getAccessCounts } from "@/lib/access/queries";
import { requireActor } from "@/lib/auth/authorize";
import { countCustomers } from "@/lib/customers/queries";
import { getMyWorkSummary } from "@/lib/employees/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Card surfaces shared with the New Order page: subtle border + soft layered shadow. */
const RAISED = "border-zinc-200/80 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)] sm:p-6";
const FLAT = "border-zinc-200/80 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6";

/**
 * Dashboard.
 *
 * Specification Section 86 (general) and Section 43 (Worker Dashboard
 * specifically): this page answers "what requires my attention right now?".
 * "Your work" is item-level and personal to the signed-in actor — shown to
 * anyone holding `orders.view`, not only an Employee-role user (renamed
 * from "Worker", owner-directed, confirmed directly 2026-10-08), since an
 * Admin can be assigned items too. The admin-only cards stay gated by their
 * own permissions exactly as before.
 *
 * Visual language matches the New Order page (2026-11-03, owner-directed):
 * a tinted workspace with raised white cards and a right-hand column.
 */
export default async function DashboardPage() {
  const actor = await requireActor();
  const canSeeUsers = actor.permissions.has("users.view");
  const canSeeCrm = actor.permissions.has("customers.view");
  const canSeeWork = actor.permissions.has("orders.view");

  const [counts, customerCount, myWork] = await Promise.all([
    canSeeUsers ? getAccessCounts() : null,
    canSeeCrm ? countCustomers() : null,
    canSeeWork ? getMyWorkSummary({ userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId }) : null,
  ]);

  const firstName = (actor.user.displayName ?? actor.user.fullName).split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description="Here's what needs your attention."
      />

      <div className="">
        {myWork ? (
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:mb-6">
            <StatTile icon={Inbox} label="New" value={myWork.newCount} tone="indigo" hint="Waiting to start" />
            <StatTile icon={CircleDashed} label="Active" value={myWork.activeCount} tone="sky" hint="Assigned or in progress" />
            <StatTile
              icon={AlarmClock}
              label="Due today"
              value={myWork.dueTodayCount}
              tone={myWork.dueTodayCount > 0 ? "amber" : "zinc"}
              hint="Deadline today (UTC)"
            />
            <StatTile
              icon={AlarmClock}
              label="Overdue"
              value={myWork.overdueCount}
              tone={myWork.overdueCount > 0 ? "red" : "zinc"}
              hint={myWork.overdueCount > 0 ? "Past their deadline" : "Nothing late"}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
          {/* ── Main column ─────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-5">
            {myWork ? (
              <>
                <Card className={RAISED}>
                  <CardHeader
                    icon={ClipboardList}
                    tone="indigo"
                    title="Your work"
                    description="Soonest deadline first."
                    actions={<CardLink href="/orders">All orders</CardLink>}
                  />

                  {myWork.attention.length > 0 ? (
                    <ul className="-mx-2 divide-y divide-zinc-100">
                      {myWork.attention.map((item) => (
                        <li key={item.itemId}>
                          <Link
                            href={`/orders/${item.orderId}`}
                            className="group flex flex-col gap-2 rounded-[8px] px-2 py-3 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="shrink-0 rounded-[6px] bg-zinc-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-zinc-600">
                                #{item.orderNumber}
                              </span>
                              <span className="truncate text-sm font-medium text-zinc-900 group-hover:underline">
                                {item.serviceName}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                              {item.deadline ? (
                                <DeadlineCountdown deadline={item.deadline} showDate={false} />
                              ) : (
                                <span className="text-xs text-zinc-500">No deadline</span>
                              )}
                              <StatusBadge tone={ITEM_STATUS_TONE[item.status]} label={item.statusLabel} className="whitespace-nowrap" />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState icon={CircleCheck} title="You're all caught up" text="No open work is assigned to you right now." />
                  )}
                </Card>

                {myWork.recentlyCompleted.length > 0 ? (
                  <Card className={FLAT}>
                    <CardHeader icon={CircleCheck} tone="emerald" title="Recently completed" description="Your latest finished items." />
                    <ul className="-mx-2 divide-y divide-zinc-100">
                      {myWork.recentlyCompleted.map((item) => (
                        <li key={item.itemId}>
                          <Link
                            href={`/orders/${item.orderId}`}
                            className="group flex items-center justify-between gap-4 rounded-[8px] px-2 py-2.5 transition-colors hover:bg-zinc-50"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500">#{item.orderNumber}</span>
                              <span className="truncate text-sm text-zinc-800 group-hover:underline">{item.serviceName}</span>
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-zinc-500">{dateFormat.format(item.completedAt)} UTC</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}
              </>
            ) : (
              <Card className={RAISED}>
                <EmptyState
                  icon={ClipboardList}
                  title="Welcome to Grow Xeno"
                  text="Use the sidebar to open the areas you have access to."
                />
              </Card>
            )}
          </div>

          {/* ── Side column ─────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-5">
            <Card className={FLAT}>
              <CardHeader icon={UserRound} tone="indigo" title="Your account" />
              <dl className="-mt-2 divide-y divide-zinc-100">
                <InfoRow label="Status">
                  <StatusDot tone={actor.user.isActive ? "done" : "danger"} label={actor.user.isActive ? "Active" : "Inactive"} />
                </InfoRow>
                <InfoRow label="Roles">
                  {actor.user.roleNames.length > 0 ? actor.user.roleNames.join(", ") : <span className="text-zinc-500">None assigned</span>}
                </InfoRow>
                <InfoRow label="Effective permissions">
                  <span className="tabular-nums">{actor.permissions.granted.size}</span>
                </InfoRow>
                <InfoRow label="Email">
                  <span className="break-all">{actor.user.email}</span>
                </InfoRow>
              </dl>
            </Card>

            {counts ? (
              <Card className={FLAT}>
                <CardHeader
                  icon={ShieldCheck}
                  tone="amber"
                  title="Access control"
                  actions={<CardLink href="/settings/users">Manage</CardLink>}
                />
                <div className="-mt-1 grid grid-cols-2 gap-2">
                  <MiniStat label="Active users" value={counts.activeUsers} />
                  <MiniStat label="Inactive users" value={counts.inactiveUsers} />
                  <MiniStat label="Roles" value={counts.roles} icon={KeyRound} />
                  <MiniStat label="Direct overrides" value={counts.directOverrides} />
                </div>
              </Card>
            ) : null}

            {customerCount !== null ? (
              <Card className={FLAT}>
                <CardHeader icon={Users} tone="emerald" title="Customers" actions={<CardLink href="/customers">Manage</CardLink>} />
                <div className="-mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums text-zinc-900">{customerCount}</span>
                  <span className="text-[13px] text-zinc-500">in the CRM</span>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────

type TileTone = "indigo" | "sky" | "amber" | "red" | "zinc";

const TILE_TONE: Record<TileTone, { chip: string; value: string; ring: string }> = {
  indigo: { chip: "bg-indigo-50 text-indigo-600", value: "text-zinc-900", ring: "" },
  sky: { chip: "bg-sky-50 text-sky-600", value: "text-zinc-900", ring: "" },
  amber: { chip: "bg-amber-50 text-amber-600", value: "text-amber-700", ring: "ring-1 ring-inset ring-amber-200/70" },
  red: { chip: "bg-red-50 text-red-600", value: "text-red-600", ring: "ring-1 ring-inset ring-red-200/70" },
  zinc: { chip: "bg-zinc-100 text-zinc-500", value: "text-zinc-900", ring: "" },
};

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: TileTone;
  hint: string;
}) {
  const t = TILE_TONE[tone];
  return (
    <div
      className={cn(
        "rounded-[12px] border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.12)] sm:p-5",
        t.ring,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-zinc-600">{label}</span>
        <span className={cn("grid size-8 place-items-center rounded-[8px]", t.chip)}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className={cn("mt-3 text-3xl font-semibold tracking-tight tabular-nums", t.value)}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
      {children}
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
    </Link>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-zinc-900">{children}</dd>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon?: LucideIcon }) {
  return (
    <div className="rounded-[10px] bg-zinc-50 px-3 py-2.5 ring-1 ring-inset ring-zinc-200/70">
      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
        {Icon ? <Icon aria-hidden="true" className="size-3" /> : null}
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-[10px] border border-dashed border-zinc-200 px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-zinc-900">{title}</p>
      <p className="mt-1 text-[13px] text-zinc-500">{text}</p>
    </div>
  );
}
