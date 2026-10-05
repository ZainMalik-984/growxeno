import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Link from "next/link";

import { Breadcrumbs, MetaList, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { requirePermission } from "@/lib/auth/authorize";
import { formatCurrencyBreakdown } from "@/lib/finance/money";
import { getWorkerEarnings } from "@/lib/finance/queries";
import { getOutsourcedWorkerDetail } from "@/lib/outsourced-workers/queries";
import { OutsourcedWorkerActivationControl } from "./outsourced-worker-activation-control";
import { OutsourcedWorkerProfileForm } from "./outsourced-worker-profile-form";

export const metadata: Metadata = { title: "Outsourced worker" };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function OutsourcedWorkerDetailPage({
  params,
}: PageProps<"/outsourced-workers/[id]">) {
  const actor = await requirePermission("workers.view.all");
  const { id } = await params;

  const worker = await getOutsourcedWorkerDetail(id);
  if (!worker) notFound();

  const canEdit = actor.permissions.has("workers.edit");
  const canViewEarnings = actor.permissions.has("finance.worker_payments.view");
  const earnings = canViewEarnings ? await getWorkerEarnings({ outsourcedWorkerId: id }) : null;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Workforce" },
          { label: "Outsourced Workers", href: "/outsourced-workers" },
          { label: worker.name },
        ]}
      />

      <PageHeader
        title={worker.name}
        actions={
          canEdit ? (
            <OutsourcedWorkerActivationControl workerId={worker.id} isActive={worker.isActive} />
          ) : undefined
        }
      />

      {!worker.isActive ? (
        <div className="mb-10 border-l-2 border-zinc-400 pl-4">
          <p className="text-[13px] font-medium text-ink">This worker is deactivated</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            They no longer appear in the assignment picker for new Order Items.
          </p>
        </div>
      ) : null}

      <Section title="Profile">
        <OutsourcedWorkerProfileForm worker={worker} canEdit={canEdit} />
      </Section>

      <Section title="Details">
        <MetaList
          items={[
            {
              label: "Status",
              value: <StatusDot tone={worker.isActive ? "done" : "neutral"} label={worker.isActive ? "Active" : "Inactive"} />,
            },
            { label: "Assigned items", value: worker.assignedItemCount },
            { label: "Created", value: `${dateFormat.format(worker.createdAt)} UTC` },
          ]}
        />
      </Section>

      {canViewEarnings && earnings ? (
        <Section
          title="Earnings"
          description="Earned from completed (or partially completed, adjusted) items — never a stored balance."
          actions={
            <Link href="/finance/worker-payments" className="text-[13px] text-ink-muted hover:text-ink hover:underline">
              All payments
            </Link>
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
    </>
  );
}
