import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, BadgeDollarSign, CircleOff, KeyRound, ListChecks, Mail, Phone, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { Breadcrumbs, Section } from "@/components/ui/page";
import { StatusBadge, StatusDot } from "@/components/ui/status-dot";
import { requirePermission } from "@/lib/auth/authorize";
import { formatCurrencyBreakdown } from "@/lib/finance/money";
import { getWorkerEarnings } from "@/lib/finance/queries";
import { getOutsourcedWorkerDetail } from "@/lib/outsourced-workers/queries";
import { listAssignableServices } from "@/lib/services/queries";
import { cn } from "@/lib/utils";
import { OutsourcedWorkerActivationControl } from "./outsourced-worker-activation-control";
import { OutsourcedWorkerLoginControl } from "./outsourced-worker-login-control";
import { ServiceRatesPanel } from "./service-rates-panel";
import { WorkerContactCard } from "./worker-contact-card";

export const metadata: Metadata = { title: "Outsourced worker" };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/**
 * Outsourced worker profile. Redesigned 2026-11-03 (owner-directed): an
 * identity header and at-a-glance stats, rates and earnings as the main
 * column, and contact details read-only with an Edit switch instead of an
 * always-open form. Data, actions and permissions are unchanged.
 */
export default async function OutsourcedWorkerDetailPage({
  params,
}: PageProps<"/outsourced-workers/[id]">) {
  const actor = await requirePermission("outsourced_workers.view");
  const { id } = await params;

  const canEdit = actor.permissions.has("outsourced_workers.edit");
  const canViewEarnings = actor.permissions.has("finance.worker_payments.view");
  // One round of requests: earnings and the service list only need the id.
  const [worker, earnings, services] = await Promise.all([
    getOutsourcedWorkerDetail(id),
    canViewEarnings ? getWorkerEarnings({ outsourcedWorkerId: id }) : Promise.resolve(null),
    canEdit ? listAssignableServices() : Promise.resolve([]),
  ]);
  if (!worker) notFound();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Workforce" },
          { label: "Outsourced Workers", href: "/outsourced-workers" },
          { label: worker.name },
        ]}
      />

      {/* ── Identity header ───────────────────────────────────────────── */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-14 shrink-0 place-items-center rounded-full text-lg font-semibold ring-4 ring-white",
              worker.isActive ? "bg-indigo-100 text-indigo-700" : "bg-zinc-200 text-zinc-500",
            )}
          >
            {initials(worker.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-zinc-900">{worker.name}</h1>
              <StatusBadge tone={worker.isActive ? "done" : "neutral"} label={worker.isActive ? "Active" : "Inactive"} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500">
              <span>Outsourced worker · since {dateFormat.format(worker.createdAt).split(",")[0]}</span>
              {worker.email ? (
                <a href={`mailto:${worker.email}`} className="inline-flex items-center gap-1 hover:text-indigo-600">
                  <Mail aria-hidden="true" className="size-3.5" />
                  {worker.email}
                </a>
              ) : null}
              {worker.phone ? (
                <a href={`tel:${worker.phone}`} className="inline-flex items-center gap-1 hover:text-indigo-600">
                  <Phone aria-hidden="true" className="size-3.5" />
                  {worker.phone}
                </a>
              ) : null}
            </p>
          </div>
        </div>

        {canEdit ? <OutsourcedWorkerActivationControl workerId={worker.id} isActive={worker.isActive} /> : null}
      </header>

      {!worker.isActive ? (
        <div className="mb-6 flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3">
          <CircleOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-[13px] font-medium text-amber-900">This worker is deactivated</p>
            <p className="mt-0.5 text-[13px] text-amber-800">They no longer appear in the assignment picker for new order items.</p>
          </div>
        </div>
      ) : null}

      {/* ── At a glance (no money here — earnings live in their own card) ── */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile icon={ListChecks} label="Assigned" value={String(worker.assignedItemCount)} hint="Currently assigned to them" />
        <StatTile icon={BadgeDollarSign} label="Rates set" value={String(worker.rates.length)} hint="Services with a per-unit rate" />
        <StatTile
          icon={KeyRound}
          label="Portal access"
          value={worker.hasLogin ? "Enabled" : "Not invited"}
          hint={worker.hasLogin ? "Can log in to their dashboard" : worker.email ? "Invite from Portal access" : "Needs an email first"}
          tone={worker.hasLogin ? "emerald" : "zinc"}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5 sm:p-6">
            <CardHeader
              icon={BadgeDollarSign}
              tone="emerald"
              title="Rates"
              description="What they charge per unit. Auto-fills an item's cost when you assign them."
            />
            <ServiceRatesPanel workerId={worker.id} rates={worker.rates} services={services} canEdit={canEdit} />
          </Card>

          {canViewEarnings && earnings ? (
            <Section
              title="Earnings"
              description="From completed (or partially completed, adjusted) items. Calculated live, not a stored balance."
              actions={
                <Link
                  href="/finance/worker-payments"
                  className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  All payments
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              }
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MoneyTile label="Earned" value={formatCurrencyBreakdown(earnings.earnedByCurrency)} />
                <MoneyTile label="Paid" value={formatCurrencyBreakdown(earnings.paidByCurrency)} />
                <MoneyTile
                  label="Outstanding"
                  value={formatCurrencyBreakdown(earnings.outstandingByCurrency)}
                  highlight={Object.values(earnings.outstandingByCurrency).some((amount) => amount > 0)}
                />
              </div>
            </Section>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-20">
          <WorkerContactCard worker={worker} canEdit={canEdit} />

          <Card className="p-5 sm:p-6">
            <CardHeader icon={KeyRound} tone="amber" title="Portal access" description="Lets them log in and see their own items and dashboard." />
            {canEdit ? (
              <OutsourcedWorkerLoginControl workerId={worker.id} hasLogin={worker.hasLogin} email={worker.email} />
            ) : (
              <StatusDot tone={worker.hasLogin ? "done" : "neutral"} label={worker.hasLogin ? "Has portal access" : "No portal access"} />
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone?: "indigo" | "emerald" | "zinc";
}) {
  const chip = { indigo: "bg-indigo-50 text-indigo-600", emerald: "bg-emerald-50 text-emerald-600", zinc: "bg-zinc-100 text-zinc-500" }[tone];
  return (
    <div className="min-w-0 rounded-[12px] border border-zinc-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.12)] sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-zinc-600 sm:text-[13px]">{label}</span>
        <span className={cn("hidden size-8 shrink-0 place-items-center rounded-[8px] sm:grid", chip)}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="mt-1.5 text-base font-semibold tracking-tight tabular-nums text-zinc-900 sm:mt-2 sm:text-2xl">{value}</p>
      <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block">{hint}</p>
    </div>
  );
}

function MoneyTile({ label, value, highlight = false }: { label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[10px] px-4 py-3 ring-1 ring-inset",
        highlight ? "bg-amber-50 ring-amber-200/80" : "bg-zinc-50 ring-zinc-200/70",
      )}
    >
      <p className={cn("flex items-center gap-1.5 text-xs font-medium", highlight ? "text-amber-800" : "text-zinc-500")}>
        <Wallet aria-hidden="true" className="size-3.5" />
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", highlight ? "text-amber-900" : "text-zinc-900")}>{value}</p>
    </div>
  );
}
