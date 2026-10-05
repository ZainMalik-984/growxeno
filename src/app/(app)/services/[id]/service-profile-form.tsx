"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MetaList } from "@/components/ui/page";
import { CURRENCIES } from "@/lib/finance/money";
import { updateServiceAction } from "@/lib/services/actions";
import { SERVICE_METRIC_TYPE_LABELS, SERVICE_METRIC_TYPES, type ServiceMetricType } from "@/lib/services/metric-type";
import type { ServiceDetail } from "@/lib/services/queries";

export function ServiceProfileForm({
  service,
  categories,
  canEdit,
}: {
  service: ServiceDetail;
  categories: ReadonlyArray<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(service.name);
  const [categoryId, setCategoryId] = useState(service.category.id);
  const [description, setDescription] = useState(service.description ?? "");
  const [basePrice, setBasePrice] = useState(service.basePrice ?? "");
  const [currency, setCurrency] = useState(service.currency);
  const [metricType, setMetricType] = useState<ServiceMetricType | "">(service.metricType ?? "");
  const [error, setError] = useState<string | undefined>();

  if (!canEdit) {
    return (
      <MetaList
        items={[
          { label: "Category", value: service.category.name },
          {
            label: "Base price",
            value: service.basePrice ? (
              `${service.basePrice} ${service.currency}`
            ) : (
              <span className="text-ink-faint">—</span>
            ),
          },
          {
            label: "Metric type",
            value: service.metricType ? SERVICE_METRIC_TYPE_LABELS[service.metricType] : <span className="text-ink-faint">—</span>,
          },
          { label: "Description", value: service.description ?? <span className="text-ink-faint">—</span> },
        ]}
      />
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateServiceAction({
        serviceId: service.id,
        name,
        categoryId,
        description: description || undefined,
        basePrice: basePrice || undefined,
        currency,
        metricType: metricType || null,
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5">
      <Field label="Name" htmlFor="edit-service-name">
        <Input id="edit-service-name" required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="Category" htmlFor="edit-service-category">
        <select
          id="edit-service-category"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Base price" htmlFor="edit-service-base-price" hint="Optional.">
          <Input
            id="edit-service-base-price"
            inputMode="decimal"
            placeholder="0.00"
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
          />
        </Field>
        <Field label="Currency" htmlFor="edit-service-currency">
          <Select id="edit-service-currency" className="w-20" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Description" htmlFor="edit-service-description" hint="Optional.">
        <Textarea
          id="edit-service-description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <Field
        label="Metric type"
        htmlFor="edit-service-metric-type"
        hint="Optional. Tag this as one of the growth metrics sold against a client's channel — Order Items against it then get a channel link and target/current count."
      >
        <select
          id="edit-service-metric-type"
          value={metricType}
          onChange={(event) => setMetricType(event.target.value as ServiceMetricType | "")}
          className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
        >
          <option value="">Not a metric service</option>
          {SERVICE_METRIC_TYPES.map((type) => (
            <option key={type} value={type}>
              {SERVICE_METRIC_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </Field>

      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={pending || !name.trim()}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
