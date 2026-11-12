"use client";

import { safeExternalHref } from "@/lib/orders/url-normalize";
import type { OrderItemStatus } from "@/generated/prisma/client";
import {
  Ban,
  Camera,
  CheckCircle2,
  Hourglass,
  ChevronRight,
  Link2,
  Pencil,
  PenLine,
  RotateCcw,
  Send,
  UserRound,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DeadlineCountdown, formatDeadlineDate, useNowMinute } from "@/components/ui/deadline";
import { formatDuration } from "@/lib/time/countdown";
import { formatPay } from "@/lib/finance/format-pay";
import { ITEM_STATUS_TONE } from "@/lib/orders/status-tone";
import { ServicePicker } from "@/components/catalog/service-picker";
import { ItemStatsPanel } from "./item-stats";
import {
  AskScreenshotsDialog,
  AskScreenshotsTrigger,
  CantContinueDialog,
  CantContinueTrigger,
  clearUpdatesParam,
  ItemUpdatesSheet,
  progressSentence,
  UpdatesTrigger,
} from "@/components/orders/item-updates";
import { keepWithWorkerAction } from "@/lib/order-updates/actions";
import { RejectTaskButton } from "../reject-task-button";
import { AssignmentDeliveryStep, MessageWorkerDialog } from "./assignment-delivery";
import type { AssignmentMessageOutcome } from "@/lib/orders/assignment-notify";
import { YoutubeLinkPreview } from "@/components/catalog/youtube-link-preview";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-dot";
import { CURRENCIES } from "@/lib/finance/money";
import {
  addOrderItemAction,
  addOrderItemLinkAction,
  assignOrderItemWorkerAction,
  reassignRemainderAction,
  cancelOrderItemWithAdjustedCostAction,
  changeOrderItemStatusAction,
  removeOrderItemAction,
  removeOrderItemLinkAction,
  setOrderItemDeadlineAction,
  updateOrderItemAction,
} from "@/lib/orders/actions";
import { isAssignedToIdentity } from "@/lib/orders/assignment";
import type { OrderItemRow } from "@/lib/orders/queries";
import { computeAssignmentCost } from "@/lib/orders/rate";
import { canTransitionItem, ORDER_ITEM_STATUS_LABELS } from "@/lib/orders/state-machine";
import { cn } from "@/lib/utils";
import { METRIC_CURRENT_LABELS, METRIC_TARGET_LABELS, SERVICE_METRIC_TYPE_LABELS } from "@/lib/services/metric-type";
import { linkFieldFor } from "@/lib/services/link-field";
import type { ServicePickerRow } from "@/lib/services/queries";
import type { Workload } from "@/lib/outsourced-workers/workload";
import { WorkloadHint } from "@/components/orders/workload";

/** A rate per service, so the assign modal can auto-fill cost the moment a worker is chosen. */
type OutsourcedWorkerOption = {
  id: string;
  name: string;
  rates: readonly { serviceId: string; rate: string; currency: string }[];
  /** What they're already working on (2026-11-11). */
  workload: Workload;
};

const ITEM_STATUSES = Object.keys(ORDER_ITEM_STATUS_LABELS) as OrderItemStatus[];


/** Rounded, colour-accented field styling shared by this panel's two modals (owner-directed, 2026-10-14/15 — real depth, not the flat default). */
const FIELD = "rounded-[8px] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const MODAL_SHELL = "m-auto w-full max-w-lg rounded-[16px] border border-zinc-200 bg-white p-0 shadow-xl shadow-zinc-900/10 backdrop:bg-zinc-950/30";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * The button for moving an item to `to` (owner-directed rework, 2026-11-03):
 * the worker accepts (straight into Processing — no separate Start), then
 * marks it done; an admin can send a done item to Refill, after which the
 * worker marks the refill done.
 */
function workflowAction(
  from: OrderItemStatus,
  to: OrderItemStatus,
): { label: string; icon: LucideIcon; variant: "accent" | "secondary" | "dangerGhost" } {
  if (to === "CANCELLED") return { label: "Cancel item", icon: XCircle, variant: "dangerGhost" };
  if (to === "PROCESSING") return { label: "Accept", icon: CheckCircle2, variant: "accent" };
  if (to === "DONE") return { label: from === "REFILL" ? "Refill done" : "Mark done", icon: CheckCircle2, variant: "accent" };
  if (to === "REFILL") return { label: "Send to refill", icon: RotateCcw, variant: "secondary" };
  return { label: ORDER_ITEM_STATUS_LABELS[to], icon: ChevronRight, variant: "secondary" };
}

const EMPTY_ITEM_FORM = {
  serviceId: "",
  description: "",
  channelLink: "",
  targetCount: "",
  currentCount: "",
  // Only used when adding a new item (confirmed directly, 2026-10-05): "i'll
  // enter 1000 as starting count, and 5000 as required, it'll automatically
  // set target to 6000" — `currentCount` doubles as "starting count" here
  // (it genuinely is the current count at creation time), and this is the
  // "how many more" half; submitItem sums them into targetCount. Editing an
  // existing item still sets targetCount directly — see openEdit/submitItem.
  requiredCount: "",
};

export function OrderItemsPanel({
  orderId,
  items,
  services,
  outsourcedWorkers,
  currentUserId,
  currentOutsourcedWorkerId,
  canCreate,
  canEdit,
  canAssign,
  canChangeStatus,
  canViewAll,
  canUploadOwn,
  showCosts,
  openUpdatesId = null,
}: {
  orderId: string;
  items: readonly OrderItemRow[];
  services: readonly ServicePickerRow[];
  outsourcedWorkers: readonly OutsourcedWorkerOption[];
  currentUserId: string;
  /** Set when the signed-in actor is an External Worker — see `Actor.outsourcedWorkerId`. */
  currentOutsourcedWorkerId: string | null;
  canCreate: boolean;
  canEdit: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  canViewAll: boolean;
  /** `orders.files.upload` — a worker may attach a link to their own item even without `orders.edit`. */
  canUploadOwn: boolean;
  /** False for an actor who may not see what workers are paid. */
  showCosts: boolean;
  /** An item whose updates open on load (from a notification, 2026-11-11). */
  openUpdatesId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogItemId, setDialogItemId] = useState<string | null | "new">(null);
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [error, setError] = useState<string | undefined>();
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set());
  const [cancelDialogItem, setCancelDialogItem] = useState<OrderItemRow | null>(null);
  const [assignDialogItem, setAssignDialogItem] = useState<OrderItemRow | null>(null);
  const [messageItemId, setMessageItemId] = useState<string | null>(null);
  // The updates thread replaces the old inline count edit (2026-11-11).
  const [updatesItemId, setUpdatesItemId] = useState<string | null>(openUpdatesId);
  const [askItem, setAskItem] = useState<OrderItemRow | null>(null);
  // "Can't continue" (2026-11-11): the worker's popup, and the team's reassign dialog.
  const [giveUpItem, setGiveUpItem] = useState<OrderItemRow | null>(null);
  const [reassignItem, setReassignItem] = useState<OrderItemRow | null>(null);

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const selectedMetricType = serviceById.get(form.serviceId)?.metricType ?? null;
  const dialogLink = selectedMetricType
    ? linkFieldFor(selectedMetricType, serviceById.get(form.serviceId)?.categoryName)
    : { label: "Link", placeholder: "https://…", noun: "link" };

  const closeDialog = () => {
    setDialogItemId(null);
    setForm(EMPTY_ITEM_FORM);
    setError(undefined);
  };

  const openAdd = () => {
    setForm(EMPTY_ITEM_FORM);
    setError(undefined);
    setDialogItemId("new");
  };

  const openEdit = (item: OrderItemRow) => {
    setForm({
      serviceId: item.service.id,
      description: item.description ?? "",
      channelLink: item.channelLink ?? "",
      targetCount: item.targetCount != null ? String(item.targetCount) : "",
      currentCount: item.currentCount != null ? String(item.currentCount) : "",
      requiredCount: "",
    });
    setError(undefined);
    setDialogItemId(item.id);
  };

  const submitItem = () => {
    startTransition(async () => {
      const isNew = dialogItemId === "new";
      const startingCount = form.currentCount !== "" ? Number(form.currentCount) : 0;
      const payload = {
        serviceId: form.serviceId,
        description: form.description || undefined,
        channelLink: selectedMetricType ? form.channelLink || undefined : undefined,
        targetCount: selectedMetricType
          ? isNew
            ? form.requiredCount !== ""
              ? startingCount + Number(form.requiredCount)
              : undefined
            : form.targetCount !== ""
              ? Number(form.targetCount)
              : undefined
          : undefined,
        currentCount: selectedMetricType && form.currentCount !== "" ? Number(form.currentCount) : undefined,
      };
      const result =
        dialogItemId === "new"
          ? await addOrderItemAction({ orderId, ...payload })
          : await updateOrderItemAction({ itemId: dialogItemId as string, ...payload });
      if (result.ok) {
        toast.success(result.message);
        closeDialog();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const removeItem = (itemId: string) => {
    startTransition(async () => {
      const result = await removeOrderItemAction({ itemId });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const changeStatus = (itemId: string, status: OrderItemStatus) => {
    startTransition(async () => {
      const result = await changeOrderItemStatusAction({ itemId, status });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const toggleLinks = (itemId: string) => {
    setExpandedLinks((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState
          title="No items yet"
          description="Add the first item to this order."
          action={
            canCreate ? (
              <Button variant="accent" className="rounded-[8px]" onClick={openAdd}>
                + Add item
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {canCreate ? (
            <div className="flex justify-end px-4 pb-4 sm:px-6">
              <Button variant="accent" size="sm" className="rounded-[8px] max-sm:h-10 max-sm:w-full" onClick={openAdd}>
                + Add item
              </Button>
            </div>
          ) : null}

          {/* Items as rows divided by hairlines inside the one Items card (2026-11-11):
              a shadowed card per item inside that card read as boxes in boxes. */}
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
            {items.map((item, index) => {
              const isSelf = isAssignedToIdentity(
                { workerId: item.worker?.id ?? null, outsourcedWorkerId: item.outsourcedWorker?.id ?? null },
                { userId: currentUserId, outsourcedWorkerId: currentOutsourcedWorkerId },
              );
              const asAssignedWorkerOnly = !canViewAll && isSelf;
              const canActorChangeThisItem = canChangeStatus && (canViewAll || isSelf);
              const canAddLinkToThisItem = canEdit || (canUploadOwn && isSelf);
              // Updates thread (2026-11-11): the team on any item; the worker on their own unless cancelled.
              // A worker posts only once they've accepted (2026-11-12).
              const canPostUpdate = canViewAll || (canChangeStatus && isSelf && (item.status === "PROCESSING" || item.status === "REFILL" || item.status === "DONE"));
              const workerView = isSelf && !canViewAll;
              const workerMustAnswer = workerView && canChangeStatus && item.status === "PENDING";
              const nextStatuses = canActorChangeThisItem
                ? ITEM_STATUSES.filter(
                    (s) =>
                      canTransitionItem(item.status, s, { asAssignedWorkerOnly }) &&
                      // Accepting needs someone to accept it.
                      !(s === "PROCESSING" && !item.outsourcedWorker && !item.worker),
                  )
                : [];
              // Cancel always renders last and visually de-emphasised — every
              // other action is the forward-moving happy path.
              const orderedNextStatuses = [...nextStatuses.filter((s) => s !== "CANCELLED"), ...nextStatuses.filter((s) => s === "CANCELLED")];

              return (
                <li key={item.id} id={`item-${item.id}`} className="scroll-mt-20 px-4 py-5 sm:px-6">
                  {/* Title row: only the name sits beside Edit / Remove, so nothing below gets squeezed (2026-11-11). */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-xs text-zinc-400">#{index + 1}</span>
                        <p className="text-[15px] font-semibold text-zinc-900">{item.service.name}</p>
                        <span className="text-xs text-zinc-400">{item.category.name}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge tone={ITEM_STATUS_TONE[item.status]} label={ORDER_ITEM_STATUS_LABELS[item.status]} />
                        {/* The team sees this until someone answers the worker's request (2026-11-11). */}
                        {canViewAll && item.hasOpenRequest ? (
                          <button
                            type="button"
                            onClick={() => setUpdatesItemId(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                          >
                            <Camera aria-hidden="true" className="size-3.5" />
                            Screenshots requested · Answer
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="-mr-2 flex shrink-0 items-center">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                          Edit
                        </Button>
                        <Button variant="dangerGhost" size="sm" onClick={() => removeItem(item.id)} disabled={pending}>
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {item.description ? <p className="mt-2 text-[13px] text-zinc-600">{item.description}</p> : null}

                  {canViewAll && item.withdrawRequest ? (
                    <WithdrawBanner
                      item={item}
                      canReassign={canAssign && canCreate}
                      onReassign={() => setReassignItem(item)}
                      onOpenUpdates={() => setUpdatesItemId(item.id)}
                    />
                  ) : null}

                  {item.service.metricType ? (
                    <ItemProgress
                      item={item}
                      metricLabel={SERVICE_METRIC_TYPE_LABELS[item.service.metricType].toLowerCase()}
                      canUpdate={canPostUpdate && item.status !== "CANCELLED" && (canViewAll || item.status === "PROCESSING" || item.status === "REFILL")}
                      onUpdate={() => setUpdatesItemId(item.id)}
                      linkHref={item.channelLink && !item.stats ? safeExternalHref(item.channelLink) : null}
                      linkNoun={linkFieldFor(item.service.metricType, item.category.name).noun}
                    />
                  ) : null}

                  {item.stats ? (
                    <div className="mt-4 border-t border-zinc-100 pt-4">
                      <ItemStatsPanel itemId={item.id} stats={item.stats} metricType={item.service.metricType} link={item.channelLink} />
                    </div>
                  ) : null}

                  {/* Who and by when, side by side from sm up. */}
                  <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Worker</p>
                      <button
                        type="button"
                        aria-label="Assign worker"
                        onClick={() => canAssign && setAssignDialogItem(item)}
                        disabled={!canAssign}
                        className={cn("-ml-1.5 flex max-w-full items-start gap-2.5 rounded-[8px] px-1.5 py-1 text-left transition-colors", canAssign && "hover:bg-zinc-50")}
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                            item.outsourcedWorker ? "bg-indigo-50 text-indigo-700" : "bg-zinc-100 text-zinc-400",
                          )}
                        >
                          {item.outsourcedWorker ? initials(item.outsourcedWorker.name) : <UserRound aria-hidden="true" className="size-3.5" />}
                        </span>
                        <span className="min-w-0 text-[13px]">
                          <span className="font-medium text-zinc-800">{item.outsourcedWorker?.name ?? item.worker?.fullName ?? "Unassigned"}</span>
                          {showCosts && item.workerCost ? (
                            <span className="text-zinc-500"> · {item.workerCost} {item.workerCostCurrency}</span>
                          ) : null}
                          {!showCosts && asAssignedWorkerOnly && item.workerCost ? (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-50 px-2 py-px text-xs font-semibold tabular-nums text-emerald-800 ring-1 ring-inset ring-emerald-200/70">
                              You earn {formatPay(item.workerCost, item.workerCostCurrency)}
                            </span>
                          ) : null}
                          {canAssign ? <span className="ml-1.5 text-indigo-600">Change</span> : null}
                          {item.assignedAt && (item.outsourcedWorker || item.worker) ? (
                            <AssignedSince assignedAt={item.assignedAt} finishedAt={item.status === "DONE" ? item.finishedAt : null} />
                          ) : null}
                        </span>
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{canViewAll ? "Worker deadline" : "Deadline"}</p>
                      <ItemDeadline item={item} canEdit={canEdit} label={canViewAll ? "Worker deadline" : "Deadline"} />
                    </div>
                  </div>

                  {/* Actions: the next step first; full width on a phone. */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {workerMustAnswer ? (
                      // Not accepted yet: Accept (below) and Reject only.
                      <RejectTaskButton itemId={item.id} serviceName={item.service.name} className="max-sm:h-10 max-sm:flex-1" />
                    ) : (
                      <UpdatesTrigger
                        count={item.updateCount}
                        canPost={canPostUpdate}
                        onClick={() => setUpdatesItemId(item.id)}
                        className="max-sm:h-10 max-sm:flex-1"
                      />
                    )}
                    {workerView && canPostUpdate && (item.status === "PROCESSING" || item.status === "REFILL") ? (
                      <AskScreenshotsTrigger waiting={item.hasOpenRequest} onClick={() => setAskItem(item)} className="max-sm:h-10 max-sm:flex-1" />
                    ) : null}
                    {workerView && canPostUpdate && (item.status === "PROCESSING" || item.status === "REFILL") ? (
                      <CantContinueTrigger sent={item.withdrawRequest !== null} onClick={() => setGiveUpItem(item)} className="max-sm:h-10 max-sm:flex-1" />
                    ) : null}
                    {orderedNextStatuses.map((status) => {
                      const action = workflowAction(item.status, status);
                      return (
                        <Button
                          key={status}
                          variant={action.variant}
                          size="sm"
                          className={cn(
                            action.variant === "accent" || action.variant === "secondary" ? "rounded-[8px]" : undefined,
                            action.variant === "accent" && "max-sm:h-10 max-sm:flex-1",
                          )}
                          disabled={pending}
                          onClick={() => {
                            // Cancelling an outsourced-worker item goes through a guided flow
                            // (adjusted cost + a required note), not a bare status flip.
                            if (status === "CANCELLED" && item.outsourcedWorker) {
                              setCancelDialogItem(item);
                            } else {
                              changeStatus(item.id, status);
                            }
                          }}
                        >
                          <action.icon aria-hidden="true" className="size-3.5" />
                          {action.label}
                        </Button>
                      );
                    })}
                    {canAssign && item.outsourcedWorker && item.status !== "DONE" && item.status !== "CANCELLED" ? (
                      <Button variant="ghost" size="sm" className="rounded-[8px]" onClick={() => setMessageItemId(item.id)}>
                        <Send aria-hidden="true" className="size-3.5" />
                        Message worker
                      </Button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Links (${item.links.length})`}
                      aria-expanded={expandedLinks.has(item.id)}
                      onClick={() => toggleLinks(item.id)}
                      className="ml-auto inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[13px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                    >
                      <Link2 aria-hidden="true" className="size-3.5" />
                      {item.links.length}
                    </button>
                  </div>

                  {expandedLinks.has(item.id) ? (
                    <ItemLinks itemId={item.id} links={item.links} canAdd={canAddLinkToThisItem} canRemove={canEdit} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Modal open={dialogItemId !== null} onClose={closeDialog} labelledBy="order-item-dialog-title" className={MODAL_SHELL}>
        <div className="flex items-start gap-3 border-b border-zinc-100 px-6 py-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-indigo-50 text-indigo-600">
            <PenLine aria-hidden="true" className="size-[18px]" />
          </div>
          <div>
            <h2 id="order-item-dialog-title" className="text-[15px] font-semibold text-zinc-900">
              {dialogItemId === "new" ? "Add item" : "Edit item"}
            </h2>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              {dialogItemId === "new" ? "Add a unit of work to this order." : "Update this item's details."}
            </p>
          </div>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Service" htmlFor="item-service">
            <ServicePicker
              id="item-service"
              services={services}
              value={form.serviceId}
              emptyLabel="Choose a service…"
              onChange={(serviceId) => setForm((c) => ({ ...c, serviceId }))}
            />
          </Field>

          {selectedMetricType ? (
            <div className="space-y-3 rounded-[12px] bg-zinc-50 p-4">
              <Field label={dialogLink.label} htmlFor="item-channel-link" hint={`The client's ${dialogLink.noun}.`}>
                <Input
                  id="item-channel-link"
                  className={FIELD}
                  type="url"
                  placeholder={dialogLink.placeholder}
                  value={form.channelLink}
                  onChange={(event) => setForm((c) => ({ ...c, channelLink: event.target.value }))}
                />
                <YoutubeLinkPreview
                  url={form.channelLink}
                  serviceId={form.serviceId}
                  metricType={selectedMetricType}
                  categoryName={serviceById.get(form.serviceId)?.categoryName}
                  currentValue={form.currentCount}
                  onUseValue={(value) => setForm((c) => ({ ...c, currentCount: String(value) }))}
                />
              </Field>
              {dialogItemId === "new" ? (
                // Confirmed directly, 2026-10-05: "a video has 1000 views, and
                // customer wants 5000 more so i'll enter 1000 as starting
                // count, and 5000 as required, it'll automatically set target
                // to 6000" — the absolute target is computed, not typed.
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={METRIC_CURRENT_LABELS[selectedMetricType]} htmlFor="item-current-count" hint="Where it stands right now. Optional — defaults to 0.">
                      <Input
                        id="item-current-count"
                        className={FIELD}
                        inputMode="numeric"
                        value={form.currentCount}
                        onChange={(event) => setForm((c) => ({ ...c, currentCount: event.target.value }))}
                      />
                    </Field>
                    <Field label={METRIC_TARGET_LABELS[selectedMetricType]} htmlFor="item-required-count" hint="How many more the customer wants.">
                      <Input
                        id="item-required-count"
                        className={FIELD}
                        inputMode="numeric"
                        value={form.requiredCount}
                        onChange={(event) => setForm((c) => ({ ...c, requiredCount: event.target.value }))}
                      />
                    </Field>
                  </div>
                  {form.requiredCount !== "" ? (
                    <p className="rounded-[8px] bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                      Target: {(form.currentCount !== "" ? Number(form.currentCount) : 0) + Number(form.requiredCount)}{" "}
                      {SERVICE_METRIC_TYPE_LABELS[selectedMetricType].toLowerCase()}
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={METRIC_TARGET_LABELS[selectedMetricType]} htmlFor="item-target-count">
                    <Input
                      id="item-target-count"
                      className={FIELD}
                      inputMode="numeric"
                      value={form.targetCount}
                      onChange={(event) => setForm((c) => ({ ...c, targetCount: event.target.value }))}
                    />
                  </Field>
                  <Field label={METRIC_CURRENT_LABELS[selectedMetricType]} htmlFor="item-current-count" hint="Optional — defaults to 0.">
                    <Input
                      id="item-current-count"
                      className={FIELD}
                      inputMode="numeric"
                      value={form.currentCount}
                      onChange={(event) => setForm((c) => ({ ...c, currentCount: event.target.value }))}
                    />
                  </Field>
                </div>
              )}
            </div>
          ) : null}

          <Field label="Note" htmlFor="item-description" hint="Optional.">
            <Textarea id="item-description" className={FIELD} rows={2} value={form.description} onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))} />
          </Field>

          {/* No worker-cost field here, 2026-10-08 — cost now lives entirely
              with assignment (the assign modal below), computed from the
              assigned External Worker's rate and editable right there. One
              place to set it, not two. */}

          {error ? (
            <p role="alert" className="text-[13px] text-red-600">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4">
          <Button variant="secondary" className="rounded-[8px]" onClick={closeDialog} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="accent"
            className="rounded-[8px]"
            onClick={submitItem}
            disabled={
              pending ||
              !form.serviceId ||
              (selectedMetricType != null &&
                (!form.channelLink.trim() ||
                  (dialogItemId === "new" ? form.requiredCount.trim() === "" : form.targetCount.trim() === "")))
            }
          >
            {pending ? "Saving…" : dialogItemId === "new" ? "Add item" : "Save"}
          </Button>
        </div>
      </Modal>

      {assignDialogItem ? (
        <AssignWorkerModal
          item={assignDialogItem}
          workers={outsourcedWorkers}
          onClose={() => setAssignDialogItem(null)}
        />
      ) : null}

      {askItem ? <AskScreenshotsDialog itemId={askItem.id} serviceName={askItem.service.name} onClose={() => setAskItem(null)} /> : null}
      {giveUpItem ? (
        <CantContinueDialog
          itemId={giveUpItem.id}
          serviceName={giveUpItem.service.name}
          progress={progressSentence(giveUpItem, giveUpItem.service.metricType ? SERVICE_METRIC_TYPE_LABELS[giveUpItem.service.metricType].toLowerCase() : null)}
          onClose={() => setGiveUpItem(null)}
        />
      ) : null}
      {reassignItem ? <ReassignRemainderDialog item={reassignItem} workers={outsourcedWorkers} onClose={() => setReassignItem(null)} /> : null}

      {updatesItemId ? (
        <ItemUpdatesSheet
          itemId={updatesItemId}
          onClose={() => {
            setUpdatesItemId(null);
            clearUpdatesParam(router.replace);
          }}
        />
      ) : null}

      {messageItemId ? <MessageWorkerDialog itemId={messageItemId} onClose={() => setMessageItemId(null)} /> : null}

      {cancelDialogItem ? (
        <CancelWithAdjustmentDialog item={cancelDialogItem} onClose={() => setCancelDialogItem(null)} />
      ) : null}
    </div>
  );
}

/**
 * The item's progress (2026-11-11): a bar with what was delivered since the
 * start out of what was asked, the current count, and "Update count", which
 * opens the item's updates thread.
 */
function ItemProgress({
  item,
  metricLabel,
  canUpdate,
  onUpdate,
  linkHref,
  linkNoun,
}: {
  item: OrderItemRow;
  metricLabel: string;
  /** May set the count (opens the updates thread). */
  canUpdate: boolean;
  onUpdate: () => void;
  /** The client's link, shown here only when there is no stats block to show it. */
  linkHref: string | null;
  linkNoun: string;
}) {
  const start = Math.max(0, item.startingCount ?? 0);
  const required = Math.max(0, (item.targetCount ?? 0) - start);
  const delivered = Math.max(0, (item.currentCount ?? start) - start);
  const percent = required > 0 ? Math.min(100, Math.round((delivered / required) * 100)) : 0;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <ProgressBar percent={percent} className="flex-1" />
        <span className="tabular w-10 text-right text-xs font-semibold text-zinc-700">{percent}%</span>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-zinc-600">
        <span>
          <span className="font-semibold text-zinc-900">{numberFormat.format(delivered)}</span> / {numberFormat.format(required)} {metricLabel} delivered
        </span>
        <span className="text-zinc-400">
          now {numberFormat.format(item.currentCount ?? start)} · target {numberFormat.format(item.targetCount ?? 0)}
        </span>
        {canUpdate ? (
          <button type="button" onClick={onUpdate} className="font-medium text-indigo-600 hover:underline">
            Update count
          </button>
        ) : null}
        {linkHref ? (
          <a href={linkHref} target="_blank" rel="noreferrer noopener" className="text-zinc-500 hover:text-zinc-900 hover:underline">
            Open {linkNoun}
          </a>
        ) : null}
      </p>
    </div>
  );
}

const numberFormat = new Intl.NumberFormat("en-US");

/**
 * How long ago the item was assigned, counting up (owner request, 2026-11-03:
 * "the outsourced worker should see how much time has passed since he's been
 * assigned"). Once the item is done it freezes into how long it took.
 */
function AssignedSince({ assignedAt, finishedAt }: { assignedAt: Date; finishedAt: Date | null }) {
  const now = useNowMinute();
  if (now === null) return null;
  const start = new Date(assignedAt).getTime();
  const text = finishedAt
    ? `done ${formatDuration(new Date(finishedAt).getTime() - start)} after assignment`
    : `assigned ${formatDuration(now - start)} ago`;
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500" title={formatDeadlineDate(assignedAt)}>
      <Hourglass aria-hidden="true" className="size-3" />
      {text}
    </span>
  );
}

/** `Date` → the value a `datetime-local` input expects, in the viewer's timezone. */
function toLocalInputValue(value: Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * The item's deadline as a countdown, with a small pencil that swaps it for a
 * date-time picker (owner request, 2026-11-03: "don't give input by default …
 * show deadline on order item with small edit icon"). For admins this is the
 * WORKER's deadline: by default the order deadline minus the gap in
 * Settings → System; once edited here it stays put until reset to automatic.
 */
function ItemDeadline({ item, canEdit, label }: { item: OrderItemRow; canEdit: boolean; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const finished = item.status === "DONE" || item.status === "CANCELLED";

  if (!item.deadline && !canEdit) return null;

  const save = (deadline: string | null) => {
    startTransition(async () => {
      const result = await setOrderItemDeadlineAction({ itemId: item.id, deadline });
      if (result.ok) {
        toast.success(result.message);
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`item-deadline-${item.id}`} className="sr-only">
          {label}
        </label>
        <Input
          id={`item-deadline-${item.id}`}
          type="datetime-local"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
            if (event.key === "Enter" && value) save(new Date(value).toISOString());
          }}
          className="h-8 w-auto rounded-[6px] text-[13px] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <Button
          variant="accent"
          size="sm"
          className="rounded-[6px]"
          disabled={pending || !value}
          onClick={() => save(new Date(value).toISOString())}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" size="sm" className="rounded-[6px]" disabled={pending} onClick={() => setEditing(false)}>
          Cancel
        </Button>
        {item.deadlineOverridden ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => save(null)}
            className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
          >
            Use automatic
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
      {item.deadline ? (
        <DeadlineCountdown deadline={item.deadline} finished={finished} />
      ) : (
        <span className="text-zinc-400">Not set — set the order deadline first</span>
      )}
      {canEdit && item.deadline ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset",
            item.deadlineOverridden ? "bg-indigo-50 text-indigo-700 ring-indigo-200/70" : "bg-zinc-50 text-zinc-500 ring-zinc-200",
          )}
          title={item.deadlineOverridden ? "Set by hand on this item" : "Follows the order deadline and the gap in Settings"}
        >
          {item.deadlineOverridden ? "Manual" : "Auto"}
        </span>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          aria-label={`Edit ${label.toLowerCase()}`}
          title="Edit deadline"
          onClick={() => {
            setValue(toLocalInputValue(item.deadline));
            setEditing(true);
          }}
          className="grid size-6 place-items-center rounded-[6px] text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Assigning a worker and setting their cost, as its own focused modal — a
 * complete redesign (owner-directed, confirmed directly 2026-10-15: "the
 * design is too flat redesign the whole page from scratch... dont use the
 * existing structure at all") replacing the old inline dropdown-plus-input
 * row. Worker rows read like a picker, not a bare `<select>`: an avatar
 * initial, their rate for this service if one exists, and a clear selected
 * state. Cost still auto-fills the instant a worker is picked and stays a
 * normal editable field — "anyone putting the item there should be able to
 * change the amount for it" (2026-10-08) — the redesign changes how this is
 * presented, not that underlying rule.
 */
function AssignWorkerModal({
  item,
  workers,
  onClose,
}: {
  item: OrderItemRow;
  workers: readonly OutsourcedWorkerOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [workerId, setWorkerId] = useState(item.outsourcedWorker?.id ?? "");
  const [cost, setCost] = useState(item.workerCost ?? "");
  const [costCurrency, setCostCurrency] = useState(item.workerCostCurrency);
  // After assigning a new worker: how they were told (email sent? WhatsApp to send), 2026-11-11.
  const [delivery, setDelivery] = useState<AssignmentMessageOutcome | null>(null);

  const pick = (id: string) => {
    setWorkerId(id);
    if (!id) {
      setCost("");
      return;
    }
    const rate = workers.find((w) => w.id === id)?.rates.find((r) => r.serviceId === item.service.id);
    const auto = computeAssignmentCost(
      { metricType: item.service.metricType, targetCount: item.targetCount, startingCount: item.startingCount },
      rate ?? null,
    );
    setCost(auto?.cost ?? "");
    setCostCurrency(auto?.currency ?? "PKR");
  };

  const save = () => {
    startTransition(async () => {
      const result = await assignOrderItemWorkerAction({
        itemId: item.id,
        outsourcedWorkerId: workerId || null,
        cost: workerId ? cost : "",
        costCurrency,
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        if (result.delivery) setDelivery(result.delivery);
        else onClose();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (delivery) {
    return (
      <Modal open onClose={onClose} labelledBy="assignment-delivery-title" className={MODAL_SHELL}>
        <AssignmentDeliveryStep itemId={item.id} delivery={delivery} onDone={onClose} />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} labelledBy="assign-worker-title" className={MODAL_SHELL}>
      <div className="flex items-start gap-3 border-b border-zinc-100 px-6 py-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-indigo-50 text-indigo-600">
          <UserRound aria-hidden="true" className="size-[18px]" />
        </div>
        <div>
          <h2 id="assign-worker-title" className="text-[15px] font-semibold text-zinc-900">
            Assign worker
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">{item.service.name}</p>
        </div>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto px-3 py-3">
        <button
          type="button"
          onClick={() => pick("")}
          className={cn(
            "flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors",
            workerId === "" ? "bg-indigo-50" : "hover:bg-zinc-50",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <UserRound aria-hidden="true" className="size-4" />
          </span>
          <span className="flex-1 text-[13px] font-medium text-zinc-500">Unassigned</span>
          {workerId === "" ? <CheckCircle2 aria-hidden="true" className="size-4 text-indigo-600" /> : null}
        </button>

        {workers.map((worker) => {
          const rate = worker.rates.find((r) => r.serviceId === item.service.id);
          const selected = workerId === worker.id;
          return (
            <button
              key={worker.id}
              type="button"
              onClick={() => pick(worker.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors",
                selected ? "bg-indigo-50" : "hover:bg-zinc-50",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                {initials(worker.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-zinc-900">{worker.name}</span>
                <span className="block text-xs text-zinc-500">
                  {rate ? `${rate.rate} ${rate.currency} per ${item.service.metricType ? "unit" : "item"}` : "No rate set"}
                </span>
                <span className="block text-xs text-zinc-500">
                  <WorkloadHint workload={worker.workload} metricType={item.service.metricType} />
                </span>
              </span>
              {selected ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-indigo-600" /> : null}
            </button>
          );
        })}
      </div>

      {workerId ? (
        <div className="flex items-end gap-2 border-t border-zinc-100 px-6 py-4">
          <Field label="Cost" htmlFor="assign-cost" hint="Auto-filled from their rate — always editable.">
            <Input id="assign-cost" className={FIELD} inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
          </Field>
          <Select
            value={costCurrency}
            onChange={(event) => setCostCurrency(event.target.value)}
            className={cn(FIELD, "w-24")}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4">
        <Button variant="secondary" className="rounded-[8px]" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="accent" className="rounded-[8px]" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save assignment"}
        </Button>
      </div>
    </Modal>
  );
}

const amount = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** What was done and what's left on an item, in its own unit. */
function splitOf(item: OrderItemRow) {
  const start = Math.max(0, item.startingCount ?? 0);
  const now = item.currentCount ?? start;
  const required = Math.max(0, (item.targetCount ?? 0) - start);
  const done = Math.min(required, Math.max(0, now - start));
  return { now, done, required, left: Math.max(0, (item.targetCount ?? 0) - now) };
}

/**
 * The team's view of a worker who can't continue (2026-11-11, owner request):
 * who, how far they got, why, and the two ways out: reassign what's left, or
 * keep it with them.
 */
function WithdrawBanner({
  item,
  canReassign,
  onReassign,
  onOpenUpdates,
}: {
  item: OrderItemRow;
  canReassign: boolean;
  onReassign: () => void;
  onOpenUpdates: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const request = item.withdrawRequest!;
  const unit = item.service.metricType ? SERVICE_METRIC_TYPE_LABELS[item.service.metricType].toLowerCase() : null;
  const { done, required, left } = splitOf(item);

  const keep = () => {
    startTransition(async () => {
      const result = await keepWithWorkerAction({ requestId: request.id, note: "" });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mt-3 rounded-[12px] bg-red-50 px-4 py-3.5 ring-1 ring-inset ring-red-200">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Ban aria-hidden="true" className="size-4 text-red-600" />
        <span className="font-semibold text-red-900">{request.authorLabel} can&apos;t continue</span>
        {unit ? (
          <span className="text-[13px] tabular-nums text-red-800">
            · {numberFormat.format(done)} of {numberFormat.format(required)} {unit} done ·{" "}
            <span className="font-semibold">{numberFormat.format(left)} left</span>
          </span>
        ) : null}
      </p>
      {request.reason ? <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-red-900/80">&ldquo;{request.reason}&rdquo;</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canReassign ? (
          <Button variant="accent" size="sm" className="rounded-[8px] max-sm:h-10 max-sm:flex-1" onClick={onReassign}>
            <UserRound aria-hidden="true" className="size-3.5" />
            Reassign what&apos;s left
          </Button>
        ) : null}
        {canReassign ? (
          <Button variant="secondary" size="sm" className="rounded-[8px] max-sm:h-10 max-sm:flex-1" onClick={keep} disabled={pending}>
            Keep with {request.authorLabel}
          </Button>
        ) : null}
        <button type="button" onClick={onOpenUpdates} className="text-[13px] font-medium text-red-800 hover:underline">
          Open updates
        </button>
      </div>
    </div>
  );
}

/**
 * Moves what's left to another worker (2026-11-11): pick who (with their
 * current load), their cost for the remainder (from their rate, editable),
 * and what the worker who stopped is paid for their part (suggested in
 *  proportion to what they did, editable). Saving marks the old item completed at what was delivered and
 * creates the new one in one step.
 */
function ReassignRemainderDialog({ item, workers, onClose }: { item: OrderItemRow; workers: readonly OutsourcedWorkerOption[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { now, done, required, left } = splitOf(item);
  const unit = item.service.metricType ? SERVICE_METRIC_TYPE_LABELS[item.service.metricType].toLowerCase() : null;
  const candidates = workers.filter((worker) => worker.id !== item.outsourcedWorker?.id);
  const [workerId, setWorkerId] = useState("");
  const [cost, setCost] = useState("");
  const [costCurrency, setCostCurrency] = useState(item.workerCostCurrency);
  // Suggested: the original pay in proportion to what they delivered.
  const original = Number(item.workerCost ?? 0);
  const [previousCost, setPreviousCost] = useState(required > 0 && original > 0 ? amount((original * done) / required) : "0.00");
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<{ itemId: string; outcome: AssignmentMessageOutcome } | null>(null);

  const pick = (id: string) => {
    setWorkerId(id);
    const rate = workers.find((w) => w.id === id)?.rates.find((r) => r.serviceId === item.service.id);
    const auto = computeAssignmentCost({ metricType: item.service.metricType, targetCount: item.targetCount, startingCount: now }, rate ?? null);
    setCost(auto?.cost ?? "");
    setCostCurrency(auto?.currency ?? item.workerCostCurrency);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await reassignRemainderAction({
        requestId: item.withdrawRequest!.id,
        outsourcedWorkerId: workerId,
        cost,
        costCurrency,
        previousWorkerCost: previousCost,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
      if (result.delivery) setDelivery({ itemId: result.newItemId, outcome: result.delivery });
      else onClose();
    });
  };

  if (delivery) {
    return (
      <Modal open onClose={onClose} labelledBy="assignment-delivery-title" className={MODAL_SHELL}>
        <AssignmentDeliveryStep itemId={delivery.itemId} delivery={delivery.outcome} onDone={onClose} />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} labelledBy="reassign-title" className={cn(MODAL_SHELL, "max-sm:mb-0 max-sm:mt-auto max-sm:max-w-none max-sm:rounded-b-none")}>
      <div className="border-b border-zinc-100 px-6 py-5">
        <h2 id="reassign-title" className="text-[15px] font-semibold text-zinc-900">
          Reassign what&apos;s left
        </h2>
        <p className="mt-0.5 text-[13px] text-zinc-500">{item.service.name}</p>
        {unit ? (
          <dl className="mt-3 grid grid-cols-3 gap-2 rounded-[10px] bg-zinc-50 p-3 text-center ring-1 ring-inset ring-zinc-200/70">
            <div>
              <dt className="text-xs text-zinc-500">Done by {item.outsourcedWorker?.name ?? "them"}</dt>
              <dd className="font-semibold tabular-nums text-zinc-900">{numberFormat.format(done)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Left to do</dt>
              <dd className="font-semibold tabular-nums text-amber-700">{numberFormat.format(left)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Target</dt>
              <dd className="font-semibold tabular-nums text-zinc-900">{numberFormat.format(item.targetCount ?? 0)}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="max-h-[40vh] space-y-1 overflow-y-auto px-3 py-3">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">New worker</p>
        {candidates.length === 0 ? <p className="px-3 py-2 text-[13px] text-zinc-500">No other active workers.</p> : null}
        {candidates.map((worker) => {
          const rate = worker.rates.find((r) => r.serviceId === item.service.id);
          const selected = workerId === worker.id;
          return (
            <button
              key={worker.id}
              type="button"
              onClick={() => pick(worker.id)}
              className={cn("flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors", selected ? "bg-indigo-50" : "hover:bg-zinc-50")}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">{initials(worker.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-zinc-900">{worker.name}</span>
                <span className="block text-xs text-zinc-500">{rate ? `${rate.rate} ${rate.currency} per unit` : "No rate set"}</span>
                <span className="block text-xs text-zinc-500">
                  <WorkloadHint workload={worker.workload} metricType={item.service.metricType} />
                </span>
              </span>
              {selected ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-indigo-600" /> : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-zinc-100 px-6 py-4">
        {workerId ? (
          <div className="flex items-end gap-2">
            <Field label={unit ? `Their cost for ${numberFormat.format(left)} ${unit}` : "Their cost"} htmlFor="reassign-cost" hint="From their rate. Always editable.">
              <Input id="reassign-cost" className={FIELD} inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
            </Field>
            <Select value={costCurrency} onChange={(event) => setCostCurrency(event.target.value)} className={cn(FIELD, "w-24")}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <Field
          label={`Pay ${item.outsourcedWorker?.name ?? "the previous worker"} for their part (${item.workerCostCurrency})`}
          htmlFor="reassign-previous-cost"
          hint={`Suggested from what they did${unit ? ` (${numberFormat.format(done)} of ${numberFormat.format(required)})` : ""}. Original: ${item.workerCost ?? "0"} ${item.workerCostCurrency}.`}
        >
          <Input id="reassign-previous-cost" className={FIELD} inputMode="decimal" value={previousCost} onChange={(event) => setPreviousCost(event.target.value)} />
        </Field>
        {error ? (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4">
        <Button variant="secondary" className="rounded-[8px]" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="accent" className="rounded-[8px]" onClick={save} disabled={pending || !workerId}>
          {pending ? "Saving…" : "Reassign"}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Guided cancel flow for an item an outsourced worker had already started
 * (specification-adjacent, confirmed directly 2026-09-17): the admin records
 * what's actually owed — the full cost, a reduced amount for partial work,
 * or nothing — plus a required note explaining what happened. See
 * `cancelOrderItemWithAdjustedCost` in `src/lib/orders/service.ts`.
 */
function CancelWithAdjustmentDialog({ item, onClose }: { item: OrderItemRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adjustedWorkerCost, setAdjustedWorkerCost] = useState(item.workerCost ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    startTransition(async () => {
      const result = await cancelOrderItemWithAdjustedCostAction({
        itemId: item.id,
        adjustedWorkerCost,
        note,
      });
      if (result.ok) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Modal open onClose={onClose} labelledBy="cancel-item-dialog-title" className={MODAL_SHELL}>
      <div className="flex items-start gap-3 border-b border-zinc-100 px-6 py-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-red-50 text-red-600">
          <XCircle aria-hidden="true" className="size-[18px]" />
        </div>
        <div>
          <h2 id="cancel-item-dialog-title" className="text-[15px] font-semibold text-zinc-900">
            Cancel &ldquo;{item.service.name}&rdquo;
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Assigned to {item.outsourcedWorker?.name}. If they had already done some of the work, adjust
            what&apos;s owed below.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-6 py-5">
        <Field
          label="Amount owed to the worker"
          htmlFor="cancel-worker-cost"
          hint={`Original: ${item.workerCost ?? "0"} ${item.workerCostCurrency}. Leave unchanged if nothing was done.`}
        >
          <Input
            id="cancel-worker-cost"
            className={FIELD}
            inputMode="decimal"
            value={adjustedWorkerCost}
            onChange={(event) => setAdjustedWorkerCost(event.target.value)}
          />
        </Field>

        <Field label="Note" htmlFor="cancel-note" hint="Required — explain what happened.">
          <Textarea id="cancel-note" className={FIELD} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>

        {error ? (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4">
        <Button variant="secondary" className="rounded-[8px]" onClick={onClose} disabled={pending}>
          Back
        </Button>
        <Button variant="dangerGhost" onClick={submit} disabled={pending || !note.trim()}>
          {pending ? "Cancelling…" : "Cancel item"}
        </Button>
      </div>
    </Modal>
  );
}

function ItemLinks({
  itemId,
  links,
  canAdd,
  canRemove,
}: {
  itemId: string;
  links: readonly { id: string; url: string; domain: string; label: string | null }[];
  canAdd: boolean;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | undefined>();

  const addLink = () => {
    startTransition(async () => {
      const result = await addOrderItemLinkAction({ itemId, url, label: label || undefined });
      if (result.ok) {
        toast.success(result.message);
        setUrl("");
        setLabel("");
        setError(undefined);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const removeLink = (linkId: string) => {
    startTransition(async () => {
      const result = await removeOrderItemLinkAction({ linkId });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mt-3 rounded-[12px] bg-zinc-50 p-3">
      {links.length === 0 ? (
        <p className="text-xs text-zinc-400">No links yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                {link.label ? <span className="text-zinc-500">{link.label}: </span> : null}
                <a href={safeExternalHref(link.url) ?? undefined} target="_blank" rel="noreferrer noopener" className="text-zinc-700 hover:underline">
                  {link.url}
                </a>
              </span>
              {canRemove ? (
                <button
                  type="button"
                  onClick={() => removeLink(link.id)}
                  disabled={pending}
                  className="shrink-0 text-zinc-400 hover:text-red-600"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canAdd ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/project"
            className="h-7 max-w-xs rounded-[6px] text-xs"
          />
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (optional)"
            className="h-7 max-w-32 rounded-[6px] text-xs"
          />
          <Button variant="secondary" size="sm" className="rounded-[6px]" onClick={addLink} disabled={pending || !url.trim()}>
            Add link
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
