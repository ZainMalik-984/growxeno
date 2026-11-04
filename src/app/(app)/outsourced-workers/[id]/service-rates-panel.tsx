"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { CURRENCIES } from "@/lib/finance/money";
import { clearServiceRateAction, setServiceRateAction } from "@/lib/outsourced-workers/actions";
import type { ServiceRateRow } from "@/lib/outsourced-workers/queries";

/**
 * An External Worker's price per service — owner-directed, confirmed
 * directly (2026-10-08): "subscriber service by Zia charges are 3.5pkr for
 * 1 subscriber." Looked up by `assignOrderItemWorker`
 * (`src/lib/orders/service.ts`) to auto-fill cost when assigning this
 * worker to an Order Item.
 *
 * Restyled 2026-11-03: rows with real buttons instead of underlined text
 * links, and the "add a rate" controls in their own tinted row. Same actions.
 */
export function ServiceRatesPanel({
  workerId,
  rates,
  services,
  canEdit,
}: {
  workerId: string;
  rates: readonly ServiceRateRow[];
  services: readonly { id: string; name: string; categoryName: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [addingServiceId, setAddingServiceId] = useState("");

  const ratedServiceIds = useMemo(() => new Set(rates.map((r) => r.serviceId)), [rates]);
  const unratedServices = useMemo(() => services.filter((s) => !ratedServiceIds.has(s.id)), [services, ratedServiceIds]);

  const openEdit = (rate: ServiceRateRow) => {
    setEditingServiceId(rate.serviceId);
    setRateValue(rate.rate);
    setCurrency(rate.currency);
  };

  const save = (serviceId: string) => {
    startTransition(async () => {
      const result = await setServiceRateAction({ workerId, serviceId, rate: rateValue, currency });
      if (result.ok) {
        toast.success(result.message);
        setEditingServiceId(null);
        setAddingServiceId("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const clear = (serviceId: string) => {
    startTransition(async () => {
      const result = await clearServiceRateAction({ workerId, serviceId });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const currencySelect = (label: string) => (
    <Select aria-label={label} value={currency} onChange={(event) => setCurrency(event.target.value)} className="w-24">
      {CURRENCIES.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </Select>
  );

  return (
    <div>
      {rates.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-zinc-200 px-4 py-6 text-center text-[13px] text-zinc-500">
          No rates set yet{canEdit ? " — add one below." : "."}
        </p>
      ) : (
        <ul className="-mx-2 divide-y divide-zinc-100">
          {rates.map((rate) => {
            const editing = editingServiceId === rate.serviceId;
            return (
              <li key={rate.serviceId} className="flex flex-wrap items-center gap-3 rounded-[8px] px-2 py-3 text-[13px] hover:bg-zinc-50/70">
                <span className="min-w-0 flex-1 font-medium text-zinc-900">{rate.serviceName}</span>
                {editing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={`Rate for ${rate.serviceName}`}
                      inputMode="decimal"
                      value={rateValue}
                      onChange={(event) => setRateValue(event.target.value)}
                      className="w-28 tabular-nums"
                      autoFocus
                    />
                    {currencySelect(`Currency for ${rate.serviceName}`)}
                    <Button variant="primary" size="sm" onClick={() => save(rate.serviceId)} disabled={pending || !rateValue.trim()}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingServiceId(null)} disabled={pending}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-700 ring-1 ring-inset ring-emerald-200/70">
                      {rate.rate} {rate.currency}
                      <span className="font-normal text-emerald-600"> / unit</span>
                    </span>
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(rate)} disabled={pending}>
                          Edit
                        </Button>
                        <Button variant="dangerGhost" size="sm" onClick={() => clear(rate.serviceId)} disabled={pending}>
                          Clear
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && unratedServices.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[10px] border border-zinc-200/80 bg-zinc-50/80 p-3">
          <Plus aria-hidden="true" className="size-4 text-zinc-400" />
          <Select
            aria-label="Add a rate for a service"
            value={addingServiceId}
            onChange={(event) => {
              setAddingServiceId(event.target.value);
              setRateValue("");
              setCurrency("PKR");
            }}
            className="w-auto min-w-48 flex-1 sm:flex-none"
          >
            <option value="">Add a rate for…</option>
            {unratedServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.categoryName} · {service.name}
              </option>
            ))}
          </Select>
          {addingServiceId ? (
            <>
              <Input
                aria-label="Rate"
                inputMode="decimal"
                value={rateValue}
                onChange={(event) => setRateValue(event.target.value)}
                placeholder="Rate"
                className="w-28 tabular-nums"
              />
              {currencySelect("Currency")}
              <Button variant="primary" size="sm" onClick={() => save(addingServiceId)} disabled={pending || !rateValue.trim()}>
                Add rate
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
