import type { Metadata } from "next";
import Link from "next/link";

import { MetaList, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { getAccessCounts } from "@/lib/access/queries";
import { requireActor } from "@/lib/auth/authorize";
import { countCustomers } from "@/lib/customers/queries";
import { getMyWorkSummary } from "@/lib/workers/queries";

export const metadata: Metadata = { title: "Dashboard" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/**
 * Dashboard.
 *
 * Specification Section 86 (general) and Section 43 (Worker Dashboard
 * specifically): this page answers "what requires my attention right now?".
 * "Your work" is item-level and personal to the signed-in actor — shown to
 * anyone holding `orders.view`, not only a Worker-role user, since an Admin
 * can be assigned items too. The admin-only sections below it stay gated by
 * their own permissions exactly as before.
 *
 * Sections with no real data source yet (revenue, daily statistics) are
 * still absent rather than fabricated — see the "Next" section.
 */
export default async function DashboardPage() {
  const actor = await requireActor();
  const canSeeUsers = actor.permissions.has("users.view");
  const canSeeCrm = actor.permissions.has("customers.view");
  const canSeeWork = actor.permissions.has("orders.view");

  const [counts, customerCount, myWork] = await Promise.all([
    canSeeUsers ? getAccessCounts() : null,
    canSeeCrm ? countCustomers() : null,
    canSeeWork ? getMyWorkSummary(actor.user.id) : null,
  ]);

  const firstName = (actor.user.displayName ?? actor.user.fullName).split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description="What needs your attention, plus the state of the access-control system."
      />

      {myWork ? (
        <Section
          title="Your work"
          actions={
            <Link href="/orders" className="text-[13px] text-ink-muted hover:text-ink hover:underline">
              All orders
            </Link>
          }
        >
          <MetaList
            items={[
              { label: "New", value: myWork.newCount },
              { label: "Active", value: myWork.activeCount },
              { label: "Due today", value: myWork.dueTodayCount },
              { label: "Overdue", value: myWork.overdueCount },
            ]}
          />

          {myWork.attention.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {myWork.attention.map((item) => (
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
            <p className="mt-4 text-[13px] text-ink-faint">No open work assigned to you.</p>
          )}
        </Section>
      ) : null}

      <Section title="Your access">
        <MetaList
          items={[
            {
              label: "Roles",
              value:
                actor.user.roleNames.length > 0 ? (
                  actor.user.roleNames.join(", ")
                ) : (
                  <span className="text-ink-faint">None assigned</span>
                ),
            },
            { label: "Effective permissions", value: actor.permissions.granted.size },
            {
              label: "Account",
              value: <StatusDot tone={actor.user.isActive ? "done" : "danger"} label={actor.user.isActive ? "Active" : "Inactive"} />,
            },
            { label: "Email", value: actor.user.email },
          ]}
        />
      </Section>

      {counts ? (
        <Section
          title="Access control"
          actions={
            <Link href="/settings/users" className="text-[13px] text-ink-muted hover:text-ink hover:underline">
              Manage
            </Link>
          }
        >
          <MetaList
            items={[
              { label: "Active users", value: counts.activeUsers },
              { label: "Inactive users", value: counts.inactiveUsers },
              { label: "Roles", value: counts.roles },
              { label: "Direct overrides", value: counts.directOverrides },
            ]}
          />
        </Section>
      ) : null}

      {customerCount !== null ? (
        <Section
          title="CRM"
          actions={
            <Link href="/customers" className="text-[13px] text-ink-muted hover:text-ink hover:underline">
              Manage
            </Link>
          }
        >
          <MetaList items={[{ label: "Customers", value: customerCount }]} />
        </Section>
      ) : null}

      <Section title="Next">
        <p className="max-w-2xl text-[13px] text-ink-muted">
          Revenue, profit and daily statistics are not shown here — they need Phase 6&apos;s daily
          statistics and Phase 7&apos;s finance ledger, which do not exist yet. Exact status per
          requirement is tracked in <code className="font-mono text-xs text-ink">docs/REQUIREMENTS.md</code>.
        </p>
      </Section>
    </>
  );
}
