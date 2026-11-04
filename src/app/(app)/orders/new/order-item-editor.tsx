"use client";

import { ArrowRight, Copy, Link2, Trash2, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { safeExternalHref } from "@/lib/orders/url-normalize";
import {
  METRIC_CURRENT_LABELS,
  METRIC_TARGET_LABELS,
  SERVICE_METRIC_TYPE_LABELS,
  type ServiceMetricType,
} from "@/lib/services/metric-type";
import type { ServicePickerRow } from "@/lib/services/queries";
import { cn } from "@/lib/utils";
import { FIELD_CLASS, FormField } from "./order-form-fields";

/**
 * One item on the New Order form (2026-11-03: an order can now be created
 * with several items at once). Same starting-count / required-count meaning
 * as the Add Item dialog (docs/ORDERS.md §13): "required" is how many MORE
 * are wanted; the stored target is current + required.
 */
export type DraftItem = {
  readonly key: string;
  readonly serviceId: string;
  readonly channelLink: string;
  readonly startingCount: string;
  readonly requiredCount: string;
};

export type ItemFieldKey = "service" | "channelLink" | "currentCount" | "requiredCount";
export type ItemErrors = Partial<Record<ItemFieldKey, string>>;

const WHOLE_NUMBER = /^\d+$/;

/** Accepts "1,000" or "1 000" as well as "1000". */
const cleanCount = (value: string) => value.replace(/[\s,]/g, "");

export const formatCount = (n: number) => n.toLocaleString("en-US");

/** DOM id of one field of one item — the first invalid one gets focus. */
export const itemFieldId = (key: string, field: ItemFieldKey) =>
  `order-item-${key}-${
    { service: "service", channelLink: "channel-link", currentCount: "starting-count", requiredCount: "required-count" }[field]
  }`;

export const ITEM_FIELD_ORDER: readonly ItemFieldKey[] = ["service", "channelLink", "currentCount", "requiredCount"];

/** Derived numbers for one item: metric, start, how many more, target. */
export function describeItem(item: DraftItem, services: readonly ServicePickerRow[]) {
  const service = services.find((s) => s.id === item.serviceId) ?? null;
  const metricType: ServiceMetricType | null = service?.metricType ?? null;
  const startingClean = cleanCount(item.startingCount);
  const requiredClean = cleanCount(item.requiredCount);
  const startingValue = startingClean !== "" && WHOLE_NUMBER.test(startingClean) ? Number(startingClean) : 0;
  const requiredValue = requiredClean !== "" && WHOLE_NUMBER.test(requiredClean) ? Number(requiredClean) : null;
  const targetValue = requiredValue !== null ? startingValue + requiredValue : null;
  const metricUnit = metricType ? SERVICE_METRIC_TYPE_LABELS[metricType].toLowerCase() : "";
  return { service, metricType, startingClean, requiredClean, startingValue, requiredValue, targetValue, metricUnit };
}

/**
 * Same rules the server applies, checked before the order exists.
 * `allowEmpty`: a lone item with no service just means "no item yet".
 */
export function validateItem(item: DraftItem, services: readonly ServicePickerRow[], allowEmpty: boolean): ItemErrors {
  const errors: ItemErrors = {};
  const d = describeItem(item, services);
  if (!item.serviceId) {
    if (!allowEmpty) errors.service = "Choose a service, or remove this item.";
    return errors;
  }
  if (!d.metricType) return errors;
  const link = item.channelLink.trim();
  if (!link) errors.channelLink = "Add the client's channel link.";
  else if (!safeExternalHref(link)) errors.channelLink = "Enter a full link, starting with https://";
  if (d.startingClean !== "" && !WHOLE_NUMBER.test(d.startingClean)) errors.currentCount = "Use a whole number (0 or more).";
  if (d.requiredClean === "") errors.requiredCount = `Enter how many ${d.metricUnit} are needed.`;
  else if (!WHOLE_NUMBER.test(d.requiredClean)) errors.requiredCount = "Use a whole number (0 or more).";
  return errors;
}

/**
 * Switching service must not carry stale, service-specific values into the
 * item: counts belong to one metric, so they reset whenever the metric
 * changes; a service with no metric clears everything. The channel link is
 * kept between two growth services because it is the same client channel —
 * which is also what makes "Duplicate with another service" useful.
 */
export function withService(item: DraftItem, nextId: string, services: readonly ServicePickerRow[]): DraftItem {
  const currentMetric = services.find((s) => s.id === item.serviceId)?.metricType ?? null;
  const nextMetric = services.find((s) => s.id === nextId)?.metricType ?? null;
  if (!nextId) return { ...item, serviceId: "" }; // keep the typed values in case another service is picked
  if (!nextMetric) return { ...item, serviceId: nextId, channelLink: "", startingCount: "", requiredCount: "" };
  if (nextMetric !== currentMetric) return { ...item, serviceId: nextId, startingCount: "", requiredCount: "" };
  return { ...item, serviceId: nextId };
}

export function OrderItemEditor({
  item,
  index,
  total,
  services,
  serviceGroups,
  errors,
  onChange,
  onDuplicate,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  total: number;
  services: readonly ServicePickerRow[];
  serviceGroups: ReadonlyArray<readonly [string, ServicePickerRow[]]>;
  errors: ItemErrors;
  onChange: (next: DraftItem, touched: ItemFieldKey[]) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const d = describeItem(item, services);
  const id = (field: ItemFieldKey) => itemFieldId(item.key, field);
  const hasLink = item.channelLink.trim() !== "";
  // A lone, empty item is the "no item yet" state: nothing to copy or remove.
  const isBlankOnly = total === 1 && !item.serviceId;

  return (
    <div className="rounded-[10px] border border-zinc-200/80 bg-white shadow-[0_1px_1px_rgba(16,24,40,0.03)]">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2.5">
        <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-zinc-900">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600 tabular-nums">
            {index + 1}
          </span>
          <span className="truncate">{d.service?.name ?? "New item"}</span>
        </p>
        {!isBlankOnly ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-[6px] text-zinc-600"
              onClick={onDuplicate}
              aria-label={`Duplicate item ${index + 1} with another service`}
              title="Copy this item's link and pick another service"
            >
              <Copy aria-hidden="true" />
              <span className="hidden sm:inline">Duplicate</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-[6px] text-zinc-500 hover:bg-red-50 hover:text-red-600"
              onClick={onRemove}
              aria-label={`Remove item ${index + 1}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        <FormField
          label="Service"
          htmlFor={id("service")}
          error={errors.service}
          hint={d.service?.basePrice ? `List price ${d.service.basePrice} ${d.service.currency}` : undefined}
        >
          <Select
            id={id("service")}
            className={cn(FIELD_CLASS, !item.serviceId && "text-zinc-500")}
            value={item.serviceId}
            aria-invalid={Boolean(errors.service) || undefined}
            aria-describedby={errors.service ? `${id("service")}-error` : undefined}
            onChange={(event) =>
              onChange(withService(item, event.target.value, services), ["service", "channelLink", "currentCount", "requiredCount"])
            }
          >
            <option value="">{total === 1 ? "No item — add later" : "Choose a service…"}</option>
            {serviceGroups.map(([category, rows]) => (
              <optgroup key={category} label={category}>
                {rows.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </FormField>

        {!item.serviceId ? (
          hasLink ? (
            <p className="flex items-center gap-2 rounded-[8px] bg-indigo-50/60 px-3 py-2.5 text-[13px] text-indigo-900 ring-1 ring-inset ring-indigo-200/60">
              <Link2 aria-hidden="true" className="size-4 shrink-0 text-indigo-600" />
              <span className="min-w-0">
                Pick a service. The link <span className="break-all font-medium">{item.channelLink.trim()}</span> is kept.
              </span>
            </p>
          ) : null
        ) : d.metricType ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <TrendingUp aria-hidden="true" className="size-3.5 text-emerald-600" />
              {SERVICE_METRIC_TYPE_LABELS[d.metricType]} growth
            </p>

            <FormField label="Channel link" htmlFor={id("channelLink")} error={errors.channelLink}>
              <Input
                id={id("channelLink")}
                className={FIELD_CLASS}
                type="url"
                placeholder="https://youtube.com/@channel"
                value={item.channelLink}
                aria-invalid={Boolean(errors.channelLink) || undefined}
                aria-describedby={errors.channelLink ? `${id("channelLink")}-error` : undefined}
                onChange={(event) => onChange({ ...item, channelLink: event.target.value }, ["channelLink"])}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label={METRIC_CURRENT_LABELS[d.metricType]}
                htmlFor={id("currentCount")}
                hint="Where it stands now. Leave empty for 0."
                error={errors.currentCount}
              >
                <Input
                  id={id("currentCount")}
                  className={cn(FIELD_CLASS, "tabular-nums")}
                  inputMode="numeric"
                  placeholder="0"
                  value={item.startingCount}
                  aria-invalid={Boolean(errors.currentCount) || undefined}
                  aria-describedby={errors.currentCount ? `${id("currentCount")}-error` : `${id("currentCount")}-hint`}
                  onChange={(event) => onChange({ ...item, startingCount: event.target.value }, ["currentCount"])}
                />
              </FormField>
              <FormField
                label={METRIC_TARGET_LABELS[d.metricType]}
                htmlFor={id("requiredCount")}
                hint="How many more the customer wants."
                error={errors.requiredCount}
              >
                <Input
                  id={id("requiredCount")}
                  className={cn(FIELD_CLASS, "tabular-nums")}
                  inputMode="numeric"
                  placeholder="e.g. 1000"
                  value={item.requiredCount}
                  aria-invalid={Boolean(errors.requiredCount) || undefined}
                  aria-describedby={errors.requiredCount ? `${id("requiredCount")}-error` : `${id("requiredCount")}-hint`}
                  onChange={(event) => onChange({ ...item, requiredCount: event.target.value }, ["requiredCount"])}
                />
              </FormField>
            </div>

            <div
              aria-live="polite"
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-[8px] px-3.5 py-2.5 text-[13px]",
                d.targetValue !== null
                  ? "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200/70"
                  : "bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200",
              )}
            >
              {d.targetValue !== null ? (
                <>
                  <span className="flex items-center gap-2 tabular-nums">
                    <span className="text-emerald-700">{formatCount(d.startingValue)}</span>
                    <ArrowRight aria-hidden="true" className="size-3.5 text-emerald-600" />
                    <span className="font-semibold">
                      {formatCount(d.targetValue)} {d.metricUnit}
                    </span>
                  </span>
                  <span className="text-xs text-emerald-700 tabular-nums">Target · +{formatCount(d.requiredValue ?? 0)}</span>
                </>
              ) : (
                <span>Enter how many more are needed to see the target.</span>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-[8px] bg-zinc-50 px-3 py-2.5 text-[13px] text-zinc-500 ring-1 ring-inset ring-zinc-200/70">
            No extra details needed. The item is added when the order is created.
          </p>
        )}
      </div>
    </div>
  );
}
