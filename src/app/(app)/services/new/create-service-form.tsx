"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CURRENCIES } from "@/lib/finance/money";
import { createServiceAction } from "@/lib/services/actions";
import { SERVICE_METRIC_TYPE_LABELS, SERVICE_METRIC_TYPES, type ServiceMetricType } from "@/lib/services/metric-type";

export function CreateServiceForm({ categories }: { categories: ReadonlyArray<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [metricType, setMetricType] = useState<ServiceMetricType | "">("");
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createServiceAction({
        name,
        categoryId,
        description: description || undefined,
        basePrice: basePrice || undefined,
        currency,
        metricType: metricType || null,
      });
      if (result.ok) {
        toast.success(result.message);
        router.push(`/services/${result.serviceId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5" noValidate>
      <Field label="Name" htmlFor="service-name">
        <Input id="service-name" required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="Category" htmlFor="service-category">
        <select
          id="service-category"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          disabled={categories.length === 0}
          className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
        >
          {categories.length === 0 ? <option value="">No categories yet</option> : null}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Base price" htmlFor="service-base-price" hint="Optional. A reference figure — an order's price is entered on the order itself.">
          <Input
            id="service-base-price"
            inputMode="decimal"
            placeholder="0.00"
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
          />
        </Field>
        <Field label="Currency" htmlFor="service-currency">
          <Select id="service-currency" className="w-20" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Description" htmlFor="service-description" hint="Optional.">
        <Textarea
          id="service-description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <Field
        label="Metric type"
        htmlFor="service-metric-type"
        hint="Optional. Tag this as one of the growth metrics sold against a client's channel — Order Items against it then get a channel link and target/current count."
      >
        <select
          id="service-metric-type"
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

      <Button type="submit" variant="primary" disabled={pending || !name.trim() || !categoryId}>
        {pending ? "Creating…" : "Create service"}
      </Button>
    </form>
  );
}
