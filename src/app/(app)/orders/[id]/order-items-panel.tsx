"use client";

import { safeExternalHref } from "@/lib/orders/url-normalize";
import type { OrderItemStatus } from "@/generated/prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { CURRENCIES } from "@/lib/finance/money";
import {
  addOrderItemAction,
  addOrderItemLinkAction,
  assignOrderItemWorkerAction,
  cancelOrderItemWithAdjustedCostAction,
  changeOrderItemStatusAction,
  removeOrderItemAction,
  removeOrderItemLinkAction,
  updateOrderItemAction,
} from "@/lib/orders/actions";
import type { OrderItemRow } from "@/lib/orders/queries";
import { canTransitionItem, ORDER_ITEM_STATUS_LABELS } from "@/lib/orders/state-machine";
import { METRIC_CURRENT_LABELS, METRIC_TARGET_LABELS, SERVICE_METRIC_TYPE_LABELS } from "@/lib/services/metric-type";
import type { ServicePickerRow } from "@/lib/services/queries";

type WorkerOption = { id: string; label: string };

const ITEM_STATUSES = Object.keys(ORDER_ITEM_STATUS_LABELS) as OrderItemStatus[];

const EMPTY_ITEM_FORM = {
  serviceId: "",
  description: "",
  deadline: "",
  channelLink: "",
  targetCount: "",
  currentCount: "",
  workerCost: "",
  workerCostCurrency: "PKR",
};

export function OrderItemsPanel({
  orderId,
  items,
  services,
  workers,
  outsourcedWorkers,
  currentUserId,
  canCreate,
  canEdit,
  canAssign,
  canChangeStatus,
  canViewAll,
  canUploadOwn,
  showCosts,
}: {
  orderId: string;
  items: readonly OrderItemRow[];
  services: readonly ServicePickerRow[];
  workers: readonly { id: string; fullName: string }[];
  outsourcedWorkers: readonly { id: string; name: string }[];
  currentUserId: string;
  canCreate: boolean;
  canEdit: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  canViewAll: boolean;
  /** `orders.files.upload` — a worker may attach a link to their own item even without `orders.edit`. */
  canUploadOwn: boolean;
  /** False for an actor who may not see what workers are paid. */
  showCosts: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogItemId, setDialogItemId] = useState<string | null | "new">(null);
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [error, setError] = useState<string | undefined>();
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set());
  const [cancelDialogItem, setCancelDialogItem] = useState<OrderItemRow | null>(null);

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const selectedMetricType = serviceById.get(form.serviceId)?.metricType ?? null;

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
      deadline: item.deadline ? item.deadline.toString().slice(0, 16) : "",
      channelLink: item.channelLink ?? "",
      targetCount: item.targetCount != null ? String(item.targetCount) : "",
      currentCount: item.currentCount != null ? String(item.currentCount) : "",
      workerCost: item.workerCost ?? "",
      workerCostCurrency: item.workerCostCurrency,
    });
    setError(undefined);
    setDialogItemId(item.id);
  };

  const submitItem = () => {
    startTransition(async () => {
      const payload = {
        serviceId: form.serviceId,
        description: form.description || undefined,
        deadline: form.deadline || null,
        channelLink: selectedMetricType ? form.channelLink || undefined : undefined,
        targetCount: selectedMetricType && form.targetCount !== "" ? Number(form.targetCount) : undefined,
        currentCount: selectedMetricType && form.currentCount !== "" ? Number(form.currentCount) : undefined,
        workerCost: form.workerCost || undefined,
        workerCostCurrency: form.workerCostCurrency,
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

  const assign = (itemId: string, value: string) => {
    const [kind, id] = value ? value.split(":") : [null, null];
    startTransition(async () => {
      const result = await assignOrderItemWorkerAction({
        itemId,
        workerId: kind === "user" ? id : null,
        outsourcedWorkerId: kind === "outsourced" ? id : null,
      });
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

  const workerOptions: WorkerOption[] = workers.map((w) => ({ id: `user:${w.id}`, label: w.fullName }));
  const outsourcedOptions: WorkerOption[] = outsourcedWorkers.map((w) => ({ id: `outsourced:${w.id}`, label: `${w.name} (outsourced)` }));

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState
          title="No items yet"
          description="Add the first item to this order."
          action={
            canCreate ? (
              <Button variant="primary" onClick={openAdd}>
                + Add item
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {canCreate ? (
            <div className="mb-4 flex justify-end">
              <Button variant="primary" size="sm" onClick={openAdd}>
                + Add item
              </Button>
            </div>
          ) : null}

          {/* One hairline-separated row per item — the same convention as
              the Notes list on this page and the Activity feed below it, not
              a bordered card: this design system treats a card around every
              repeating row as the thing to avoid (docs/DESIGN_SYSTEM.md §1),
              so "ticket-like" comes from typography and alignment (the
              service name as the title, a faint mono item number, a quiet
              meta row underneath), never from a box. Reworked 2026-10-01
              after the card version read as cluttered. */}
          <ul>
            {items.map((item, index) => {
              const isSelf = item.worker?.id === currentUserId;
              const asAssignedWorkerOnly = !canViewAll && isSelf;
              const canActorChangeThisItem = canChangeStatus && (canViewAll || isSelf);
              const canAddLinkToThisItem = canEdit || (canUploadOwn && isSelf);
              const nextStatuses = canActorChangeThisItem
                ? ITEM_STATUSES.filter((s) => canTransitionItem(item.status, s, { asAssignedWorkerOnly }))
                : [];
              const currentAssignmentValue = item.worker
                ? `user:${item.worker.id}`
                : item.outsourcedWorker
                  ? `outsourced:${item.outsourcedWorker.id}`
                  : "";

              return (
                <li key={item.id} className="border-b border-line-soft py-4 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">
                        <span className="font-mono text-xs text-ink-faint">#{index + 1}</span>{" "}
                        {item.service.name} <span className="text-ink-faint">· {item.category.name}</span>
                      </p>
                      {item.description ? <p className="mt-0.5 text-[13px] text-ink-muted">{item.description}</p> : null}
                      {item.service.metricType ? (
                        <p className="mt-1 text-xs text-ink-faint">
                          {item.currentCount ?? 0} / {item.targetCount ?? 0} {SERVICE_METRIC_TYPE_LABELS[item.service.metricType].toLowerCase()}
                          {item.channelLink ? (
                            <>
                              {" · "}
                              <a
                                href={safeExternalHref(item.channelLink) ?? undefined}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-ink-muted hover:text-ink hover:underline"
                              >
                                channel
                              </a>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {showCosts && item.workerCost ? (
                        <p className="mt-1 text-xs text-ink-faint">{item.workerCost} {item.workerCostCurrency} worker cost</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusDot tone="active" label={ORDER_ITEM_STATUS_LABELS[item.status]} />
                      {canEdit ? (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                          Edit
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button variant="dangerGhost" size="sm" onClick={() => removeItem(item.id)} disabled={pending}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
                    {canAssign ? (
                      <label className="flex items-center gap-2 text-[13px] text-ink-muted">
                        Assigned to
                        <Select
                          value={currentAssignmentValue}
                          onChange={(event) => assign(item.id, event.target.value)}
                          disabled={pending}
                          className="h-7 w-auto"
                        >
                          <option value="">Unassigned</option>
                          {workerOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                          {outsourcedOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </label>
                    ) : (
                      <span className="text-[13px] text-ink-muted">
                        {item.worker?.fullName ?? item.outsourcedWorker?.name ?? (
                          <span className="text-ink-faint">Unassigned</span>
                        )}
                      </span>
                    )}

                    {nextStatuses.length > 0 ? (
                      <label className="flex items-center gap-2 text-[13px] text-ink-muted">
                        Move to
                        <Select
                          value=""
                          onChange={(event) => {
                            const status = event.target.value as OrderItemStatus;
                            if (!status) return;
                            // Cancelling an outsourced-worker item goes through a
                            // guided flow (adjusted cost + a required note) —
                            // see docs/ORDERS.md's cancellation-with-partial-work
                            // note — rather than a bare status flip.
                            if (status === "CANCELLED" && item.outsourcedWorker) {
                              setCancelDialogItem(item);
                            } else {
                              changeStatus(item.id, status);
                            }
                          }}
                          disabled={pending}
                          className="h-7 w-auto"
                        >
                          <option value="">Choose…</option>
                          {nextStatuses.map((status) => (
                            <option key={status} value={status}>
                              {ORDER_ITEM_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </Select>
                      </label>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => toggleLinks(item.id)}
                      className="text-[13px] text-ink-muted hover:text-ink hover:underline"
                    >
                      Links ({item.links.length})
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

      <Modal open={dialogItemId !== null} onClose={closeDialog} labelledBy="order-item-dialog-title">
        <h2 id="order-item-dialog-title" className="text-[15px] font-medium text-ink-strong">
          {dialogItemId === "new" ? "Add item" : "Edit item"}
        </h2>

        <div className="mt-5 space-y-4">
          <Field label="Service" htmlFor="item-service">
            <Select
              id="item-service"
              value={form.serviceId}
              onChange={(event) => setForm((c) => ({ ...c, serviceId: event.target.value }))}
              autoFocus
            >
              <option value="">Choose a service…</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.categoryName} · {service.name}
                </option>
              ))}
            </Select>
          </Field>

          {selectedMetricType ? (
            <>
              <Field label="Channel link" htmlFor="item-channel-link" hint="The client's channel.">
                <Input
                  id="item-channel-link"
                  type="url"
                  placeholder="https://youtube.com/@channel"
                  value={form.channelLink}
                  onChange={(event) => setForm((c) => ({ ...c, channelLink: event.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={METRIC_TARGET_LABELS[selectedMetricType]} htmlFor="item-target-count">
                  <Input
                    id="item-target-count"
                    inputMode="numeric"
                    value={form.targetCount}
                    onChange={(event) => setForm((c) => ({ ...c, targetCount: event.target.value }))}
                  />
                </Field>
                <Field label={METRIC_CURRENT_LABELS[selectedMetricType]} htmlFor="item-current-count" hint="Optional — defaults to 0.">
                  <Input
                    id="item-current-count"
                    inputMode="numeric"
                    value={form.currentCount}
                    onChange={(event) => setForm((c) => ({ ...c, currentCount: event.target.value }))}
                  />
                </Field>
              </div>
            </>
          ) : null}

          <Field label="Note" htmlFor="item-description" hint="Optional.">
            <Textarea id="item-description" rows={2} value={form.description} onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))} />
          </Field>

          <Field label="Item deadline" htmlFor="item-deadline" hint="Optional — falls back to the order deadline.">
            <Input id="item-deadline" type="datetime-local" value={form.deadline} onChange={(event) => setForm((c) => ({ ...c, deadline: event.target.value }))} />
          </Field>

          {/* Not shown when adding a new item (confirmed directly, 2026-09-28):
              there is usually no worker assigned yet at creation time, so
              there is nothing real to cost. Set it once someone is assigned,
              via Edit. */}
          {dialogItemId !== "new" ? (
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label="Worker cost" htmlFor="item-worker-cost" hint="Optional. What it costs to fulfil this item.">
                <Input id="item-worker-cost" inputMode="decimal" value={form.workerCost} onChange={(event) => setForm((c) => ({ ...c, workerCost: event.target.value }))} />
              </Field>
              <Field label="Currency" htmlFor="item-worker-cost-currency">
                <Select id="item-worker-cost-currency" className="w-20" value={form.workerCostCurrency} onChange={(event) => setForm((c) => ({ ...c, workerCostCurrency: event.target.value }))}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-[13px] text-red-600">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={closeDialog} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitItem}
            disabled={
              pending ||
              !form.serviceId ||
              (selectedMetricType != null && (!form.channelLink.trim() || form.targetCount.trim() === ""))
            }
          >
            {pending ? "Saving…" : dialogItemId === "new" ? "Add item" : "Save"}
          </Button>
        </div>
      </Modal>

      {cancelDialogItem ? (
        <CancelWithAdjustmentDialog item={cancelDialogItem} onClose={() => setCancelDialogItem(null)} />
      ) : null}
    </div>
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
    <Modal open onClose={onClose} labelledBy="cancel-item-dialog-title">
      <h2 id="cancel-item-dialog-title" className="text-[15px] font-medium text-ink-strong">
        Cancel &ldquo;{item.service.name}&rdquo;
      </h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Assigned to {item.outsourcedWorker?.name}. If they had already done some of the work, adjust
        what&apos;s owed below — the worker&apos;s earnings reflect this amount, not the original cost.
      </p>

      <div className="mt-5 space-y-4">
        <Field
          label="Amount owed to the worker"
          htmlFor="cancel-worker-cost"
          hint={`Original: ${item.workerCost ?? "0"} ${item.workerCostCurrency}. Leave unchanged if nothing was done.`}
        >
          <Input
            id="cancel-worker-cost"
            inputMode="decimal"
            value={adjustedWorkerCost}
            onChange={(event) => setAdjustedWorkerCost(event.target.value)}
          />
        </Field>

        <Field label="Note" htmlFor="cancel-note" hint="Required — explain what happened.">
          <Textarea id="cancel-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>

        {error ? (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
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
    <div className="mt-3 rounded-[3px] border border-line-soft bg-canvas-subtle p-3">
      {links.length === 0 ? (
        <p className="text-xs text-ink-faint">No links yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                {link.label ? <span className="text-ink-muted">{link.label}: </span> : null}
                <a href={safeExternalHref(link.url) ?? undefined} target="_blank" rel="noreferrer noopener" className="text-ink hover:underline">
                  {link.url}
                </a>
              </span>
              {canRemove ? (
                <button
                  type="button"
                  onClick={() => removeLink(link.id)}
                  disabled={pending}
                  className="shrink-0 text-ink-faint hover:text-red-600"
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
            className="h-7 max-w-xs text-xs"
          />
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (optional)"
            className="h-7 max-w-32 text-xs"
          />
          <Button variant="secondary" size="sm" onClick={addLink} disabled={pending || !url.trim()}>
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
