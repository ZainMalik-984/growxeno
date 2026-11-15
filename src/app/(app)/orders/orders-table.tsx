"use client";

import { Ban, Camera, CheckCircle2, ChevronDown, ExternalLink, Eye, ListTree } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SiYoutube } from "react-icons/si";
import { toast } from "sonner";

import { CategoryThumb } from "@/components/catalog/category-thumb";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { DeadlineCountdown } from "@/components/ui/deadline";
import { StatusBadge, StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { changeOrderItemStatusAction } from "@/lib/orders/actions";
import { cn } from "@/lib/utils";

/**
 * The orders list for the team (admins, employees; owner request 2026-11-15:
 * "update the Orders page for employee and admins as well", in the
 * progress-rings design the worker list uses). One compact row per order: a
 * progress ring, the order and customer, its services as logo + name, the
 * channel, status and amount, and the deadline; actions sit in a "⋯" menu.
 * The services line opens the order's items under the row (confirmed
 * 2026-10-05: "each row would be a dropdown ... who its assigned to and
 * progress"). All redaction already happened server-side
 * (src/lib/orders/visibility.ts's `redactOrderListItems`): `items` here is
 * only what this actor may see.
 */

/** `title` is the channel/video name read from YouTube, shown with the link (2026-11-11). */
export type ChannelLink = { href: string; label: string; title?: string | null };

export type OrdersTableItem = {
  id: string;
  channel: ChannelLink | null;
  /** The signed-in worker's own pending item: offer Accept. */
  canAccept: boolean;
  serviceName: string;
  /** Shown as category logo + service name (2026-11-15). */
  serviceTitle?: string;
  categoryName?: string;
  categoryImageUrl?: string | null;
  assigneeLabel: string;
  assigned?: boolean;
  statusLabel: string;
  statusTone: StatusTone;
  metricLabel: string | null;
  startingCount: number | null;
  currentCount: number | null;
  targetCount: number | null;
};

export type OrdersTableRow = {
  id: string;
  orderNumber: number;
  customerName: string | null;
  statusLabel: string;
  statusTone: StatusTone;
  /** For a worker, their own (earliest item) deadline. */
  deadline: Date | null;
  /** Completed, delivered or cancelled: show the date, no countdown. */
  finished: boolean;
  /** Past its deadline and not finished. */
  isOverdue: boolean;
  itemCount: number;
  amountLabel: string | null;
  progressPercent: number | null;
  /** Distinct client channels across this row's visible items. */
  channels: ChannelLink[];
  /** Screenshot requests waiting for the team on this order (team view only, 2026-11-11). */
  openRequests: number;
  /** Items whose worker can't continue, waiting to be reassigned (team view only). */
  withdrawRequests: number;
  items: OrdersTableItem[];
};

const numberFormat = new Intl.NumberFormat("en-US");
const GRID = "md:grid-cols-[44px_minmax(0,1fr)_150px_170px_32px]";

export function OrdersTable({
  rows,
  showCustomer,
  showAmount,
}: {
  rows: OrdersTableRow[];
  showCustomer: boolean;
  showAmount: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Same server action and rules as Accept on the order page; one at a time, since each recalculates the order.
  const accept = (key: string, itemIds: string[]) => {
    setBusy(key);
    startTransition(async () => {
      let accepted = 0;
      let firstError: string | null = null;
      for (const itemId of itemIds) {
        const result = await changeOrderItemStatusAction({ itemId, status: "PROCESSING" });
        if (result.ok) accepted += 1;
        else firstError ??= result.error;
      }
      if (accepted > 0) toast.success(accepted === 1 ? "Task accepted." : `${accepted} tasks accepted.`);
      if (firstError) toast.error(firstError);
      setBusy(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className={cn("hidden gap-x-4 border-b border-zinc-200/80 bg-zinc-50/80 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 md:grid", GRID)}>
        <span className="col-span-2">Order</span>
        <span>{showAmount ? "Status & amount" : "Status"}</span>
        <span className="text-right">Deadline</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul aria-label="Orders" className="divide-y divide-zinc-100">
        {rows.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            showCustomer={showCustomer}
            showAmount={showAmount}
            open={expanded.has(order.id)}
            onToggle={() => toggle(order.id)}
            busy={busy}
            onAccept={accept}
          />
        ))}
      </ul>
    </>
  );
}

function OrderRow({
  order,
  showCustomer,
  showAmount,
  open,
  onToggle,
  busy,
  onAccept,
}: {
  order: OrdersTableRow;
  showCustomer: boolean;
  showAmount: boolean;
  open: boolean;
  onToggle: () => void;
  busy: string | null;
  onAccept: (key: string, itemIds: string[]) => void;
}) {
  const acceptable = order.items.filter((item) => item.canAccept);
  const first = order.items[0];
  const channel = order.channels[0];
  const accepting = busy === order.id;

  const menu: ActionMenuItem[] = [
    ...(acceptable.length > 0
      ? [
          {
            label: accepting ? "Accepting…" : acceptable.length > 1 ? `Accept ${acceptable.length} tasks` : "Accept task",
            icon: CheckCircle2,
            tone: "primary" as const,
            disabled: accepting,
            onSelect: () => onAccept(order.id, acceptable.map((item) => item.id)),
          },
          "separator" as const,
        ]
      : []),
    { label: "Open order", icon: Eye, href: `/orders/${order.id}` },
    ...(order.items.length > 0 ? [{ label: open ? "Hide items" : `Show items (${order.items.length})`, icon: ListTree, onSelect: onToggle }] : []),
    ...(channel ? [{ label: isYoutube(channel.href) ? "Open on YouTube" : "Open link", icon: ExternalLink, href: channel.href, external: true }] : []),
  ];

  return (
    <li className={cn("relative transition-colors hover:bg-zinc-50/70", open && "bg-zinc-50/70")}>
      <Link href={`/orders/${order.id}`} className="absolute inset-0" aria-label={`Open order #${order.orderNumber}`} />

      <div className={cn("grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3.5 md:items-center md:gap-x-4 md:px-5", GRID)}>
        <Ring percent={order.progressPercent} />

        <div className="min-w-0">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="text-[14px] font-semibold tabular-nums text-zinc-900">#{order.orderNumber}</span>
            {showCustomer && order.customerName ? <span className="truncate text-[13px] text-zinc-500">{order.customerName}</span> : null}
          </p>
          {first ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={`${open ? "Hide" : "Show"} the items of order #${order.orderNumber}`}
              className="relative mt-0.5 inline-flex max-w-full items-center gap-1.5 rounded-[6px] text-[13px] font-medium text-zinc-800 hover:text-indigo-700"
            >
              <ServiceLogo item={first} />
              <span className="truncate">{first.serviceTitle ?? first.serviceName}</span>
              {order.items.length > 1 ? <span className="shrink-0 text-xs font-normal text-zinc-500">+{order.items.length - 1} more</span> : null}
              <ChevronDown aria-hidden="true" className={cn("size-3.5 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
            </button>
          ) : null}
          {channel ? (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
              <ChannelAnchor channel={channel} />
              {order.channels.length > 1 ? (
                <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-600" title={order.channels.slice(1).map((c) => c.label).join("\n")}>
                  +{order.channels.length - 1}
                </span>
              ) : null}
            </div>
          ) : null}
          {/* Phones: status and amount under the link. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 md:hidden">
            <StatusBadge tone={order.statusTone} label={order.statusLabel} className="px-2 py-0.5" />
            {showAmount && order.amountLabel ? <span className="text-[13px] font-semibold tabular-nums text-zinc-900">{order.amountLabel}</span> : null}
          </div>
          <Flags order={order} />
        </div>

        <div className="hidden md:block">
          <StatusBadge tone={order.statusTone} label={order.statusLabel} className="px-2 py-0.5" />
          {showAmount && order.amountLabel ? <p className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-900">{order.amountLabel}</p> : null}
        </div>

        {/* Phones: deadline and the menu top right; from md each is its own column. */}
        <div className="flex items-start gap-1 md:contents">
          <div className="text-right">
            {order.deadline ? (
              <DeadlineCountdown deadline={order.deadline} finished={order.finished} stacked className="items-end" />
            ) : (
              <span className="text-xs text-zinc-400">No deadline</span>
            )}
          </div>
          <ActionMenu label={`Actions for order #${order.orderNumber}`} items={menu} className="relative -mr-1.5 md:mr-0" />
        </div>
      </div>

      {open ? (
        <ul aria-label={`Items of order #${order.orderNumber}`} className="relative mx-4 mb-3 divide-y divide-zinc-100 rounded-[10px] border border-zinc-200/80 bg-white md:ml-[76px] md:mr-5">
          {order.items.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-zinc-500">No items visible.</li>
          ) : (
            order.items.map((item) => <ItemLine key={item.id} item={item} busy={busy === item.id} onAccept={() => onAccept(item.id, [item.id])} />)
          )}
        </ul>
      ) : null}
    </li>
  );
}

/** One item under an opened order: ring, logo + service, who has it, delivered, status. */
function ItemLine({ item, busy, onAccept }: { item: OrdersTableItem; busy: boolean; onAccept: () => void }) {
  const progress = itemProgress(item);
  const menu: ActionMenuItem[] = [
    ...(item.canAccept ? [{ label: busy ? "Accepting…" : "Accept task", icon: CheckCircle2, tone: "primary" as const, disabled: busy, onSelect: onAccept }] : []),
    ...(item.channel ? [{ label: isYoutube(item.channel.href) ? "Open on YouTube" : "Open link", icon: ExternalLink, href: item.channel.href, external: true }] : []),
  ];
  const assigned = item.assigned ?? item.assigneeLabel !== "Unassigned";
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 text-[13px]">
      <Ring percent={progress?.percent ?? null} size={28} />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 font-medium text-zinc-900">
          <ServiceLogo item={item} size={16} />
          <span className="truncate">{item.serviceTitle ?? item.serviceName}</span>
        </p>
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-4 items-center justify-center rounded-full text-[9px] font-semibold",
                assigned ? "bg-indigo-600 text-white" : "border border-dashed border-zinc-300 text-zinc-400",
              )}
            >
              {assigned ? initials(item.assigneeLabel) : ""}
            </span>
            <span className={assigned ? "text-zinc-700" : undefined}>{item.assigneeLabel}</span>
          </span>
          {progress ? (
            <span className="tabular-nums">
              <span className="font-medium text-zinc-700">{numberFormat.format(progress.delivered)}</span> of {numberFormat.format(progress.required)} {item.metricLabel}
              {item.currentCount !== null ? <span className="text-zinc-400"> · now {numberFormat.format(item.currentCount)}</span> : null}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <StatusDot tone={item.statusTone} label={item.statusLabel} />
        {menu.length > 0 ? <ActionMenu label={`Actions for ${item.serviceTitle ?? item.serviceName}`} items={menu} buttonClassName="size-7" /> : null}
      </div>
    </li>
  );
}

/** Delivered since the start, out of what was asked for, as the ring measures it. */
function itemProgress(item: OrdersTableItem): { delivered: number; required: number; percent: number } | null {
  if (!item.metricLabel || item.targetCount === null) return null;
  const start = Math.max(0, item.startingCount ?? 0);
  const delivered = Math.max(0, (item.currentCount ?? start) - start);
  const required = Math.max(0, item.targetCount - start);
  return { delivered, required, percent: required > 0 ? Math.min(100, Math.round((delivered / required) * 100)) : 0 };
}

function ServiceLogo({ item, size = 18 }: { item: OrdersTableItem; size?: number }) {
  if (!item.categoryName) return null;
  return <CategoryThumb name={item.categoryName} imageUrl={item.categoryImageUrl ?? null} size={size} className="rounded-[5px]" />;
}

/** Progress as a ring with the percentage inside. */
function Ring({ percent, size = 44 }: { percent: number | null; size?: number }) {
  const stroke = size <= 28 ? 3 : 4;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={percent === null ? "No progress to show" : `${value}% done`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-zinc-200/80" />
      {percent !== null && value > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c.toFixed(2)}
          strokeDashoffset={(c * (1 - value / 100)).toFixed(2)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={value >= 100 ? "stroke-emerald-500" : "stroke-indigo-600"}
        />
      ) : null}
      {size > 28 ? (
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-zinc-800 text-[11px] font-semibold tabular-nums">
          {percent === null ? "—" : `${value}%`}
        </text>
      ) : null}
    </svg>
  );
}

function Flags({ order }: { order: OrdersTableRow }) {
  if (order.withdrawRequests === 0 && order.openRequests === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {order.withdrawRequests > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
          <Ban aria-hidden="true" className="size-3" />
          Can&apos;t continue
        </span>
      ) : null}
      {order.openRequests > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
          <Camera aria-hidden="true" className="size-3" />
          {order.openRequests === 1 ? "Screenshots requested" : `${order.openRequests} screenshot requests`}
        </span>
      ) : null}
    </div>
  );
}

/** Opens the client's channel in a new tab; never fetched by the server. */
function ChannelAnchor({ channel }: { channel: ChannelLink }) {
  return (
    <a
      href={channel.href}
      target="_blank"
      rel="noreferrer noopener"
      title={channel.href}
      className="relative inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
    >
      {isYoutube(channel.href) ? <SiYoutube aria-hidden="true" className="size-3.5 shrink-0 text-[#FF0000]" /> : null}
      <span className="truncate">{channel.title ?? channel.label}</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function isYoutube(href: string): boolean {
  return /youtube\.com|youtu\.be/i.test(href);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}
