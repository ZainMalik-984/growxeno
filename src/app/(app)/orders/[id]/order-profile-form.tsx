"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { MetaList } from "@/components/ui/page";
import { updateOrderAction } from "@/lib/orders/actions";
import type { OrderDetail } from "@/lib/orders/queries";
import { CustomerPicker, type SelectedCustomer } from "../customer-picker";

// Owner-directed simplification (confirmed directly, 2026-09-27: "currently
// there are only two sources for order Fiverr and External"), replacing the
// original generic four-value enum (DIRECT/WHOLESALE/MANUAL/OTHER).
const SOURCES = ["FIVERR", "EXTERNAL"] as const;

/** Converts a stored UTC instant to the value a `datetime-local` input expects. */
function toLocalInputValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function OrderProfileForm({
  order,
  fiverrAccounts,
  canEdit,
  canCreateCustomer,
}: {
  order: OrderDetail;
  fiverrAccounts: ReadonlyArray<{ id: string; name: string }>;
  canEdit: boolean;
  canCreateCustomer: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [source, setSource] = useState<(typeof SOURCES)[number]>(order.source);
  const [externalReference, setExternalReference] = useState(order.externalReference ?? "");
  const [customer, setCustomer] = useState<SelectedCustomer | null>(order.customer ?? null);
  const [fiverrAccountId, setFiverrAccountId] = useState(order.fiverrAccount?.id ?? "");
  const [totalAmount, setTotalAmount] = useState(order.totalAmount);
  const [deadline, setDeadline] = useState(toLocalInputValue(order.deadline));
  const [notes, setNotes] = useState(order.notes ?? "");
  const [error, setError] = useState<string | undefined>();

  if (!canEdit) {
    return (
      <MetaList
        items={[
          { label: "Source", value: order.source[0] + order.source.slice(1).toLowerCase() },
          { label: "External reference", value: order.externalReference ?? <span className="text-ink-faint">—</span> },
          { label: "Customer", value: order.customer?.name ?? <span className="text-ink-faint">—</span> },
          { label: "Fiverr account", value: order.fiverrAccount?.name ?? <span className="text-ink-faint">—</span> },
          { label: "Notes", value: order.notes ?? <span className="text-ink-faint">—</span> },
        ]}
      />
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateOrderAction({
        orderId: order.id,
        source,
        externalReference: externalReference || undefined,
        customerId: customer?.id ?? null,
        fiverrAccountId: source === "FIVERR" ? fiverrAccountId || null : null,
        totalAmount: totalAmount || undefined,
        deadline: deadline ? new Date(`${deadline}:00Z`).toISOString() : null,
        notes: notes || undefined,
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
      <Field label="Source" htmlFor="edit-order-source">
        <select
          id="edit-order-source"
          value={source}
          onChange={(event) => setSource(event.target.value as typeof source)}
          className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
        >
          {SOURCES.map((value) => (
            <option key={value} value={value}>
              {value[0] + value.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </Field>

      <Field label="External reference" htmlFor="edit-order-external-reference" hint="Optional.">
        <Input id="edit-order-external-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} />
      </Field>

      <Field label="Customer" htmlFor="edit-order-customer" hint="Optional. Type a name to search, or create one.">
        <CustomerPicker id="edit-order-customer" initial={customer} onChange={setCustomer} canCreate={canCreateCustomer} />
      </Field>

      {source === "FIVERR" ? (
        <Field label="Fiverr account" htmlFor="edit-order-fiverr-account" hint="Which of your Fiverr profiles this order came in on.">
          <select
            id="edit-order-fiverr-account"
            value={fiverrAccountId}
            onChange={(event) => setFiverrAccountId(event.target.value)}
            className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
          >
            <option value="">Choose…</option>
            {fiverrAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Order price" htmlFor="edit-order-total-amount" hint="The whole order's price, not per item.">
        <Input
          id="edit-order-total-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={totalAmount}
          onChange={(event) => setTotalAmount(event.target.value)}
        />
      </Field>

      <Field label="Deadline" htmlFor="edit-order-deadline" hint="Required before the order can be processed.">
        <Input id="edit-order-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </Field>

      <Field label="Notes" htmlFor="edit-order-notes" hint="Optional.">
        <Textarea id="edit-order-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={pending || (source === "FIVERR" && !fiverrAccountId)}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
