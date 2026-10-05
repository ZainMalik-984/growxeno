"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createOrderAction } from "@/lib/orders/actions";
import { CustomerPicker, type SelectedCustomer } from "../customer-picker";

// Owner-directed simplification (confirmed directly, 2026-09-27: "currently
// there are only two sources for order Fiverr and External"), replacing the
// original generic four-value enum (DIRECT/WHOLESALE/MANUAL/OTHER).
const SOURCES = ["FIVERR", "EXTERNAL"] as const;

export function CreateOrderForm({
  fiverrAccounts,
  canCreateCustomer,
}: {
  fiverrAccounts: ReadonlyArray<{ id: string; name: string }>;
  canCreateCustomer: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [source, setSource] = useState<(typeof SOURCES)[number]>("EXTERNAL");
  const [externalReference, setExternalReference] = useState("");
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [fiverrAccountId, setFiverrAccountId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createOrderAction({
        source,
        externalReference: externalReference || undefined,
        customerId: customer?.id ?? null,
        fiverrAccountId: source === "FIVERR" ? fiverrAccountId || null : null,
        totalAmount: totalAmount || undefined,
        deadline: deadline || null,
        notes: notes || undefined,
      });
      if (result.ok) {
        toast.success(result.message);
        router.push(`/orders/${result.orderId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5" noValidate>
      <Field label="Source" htmlFor="order-source">
        <select
          id="order-source"
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

      <Field
        label="External reference"
        htmlFor="order-external-reference"
        hint="Optional. e.g. a Fiverr order id — recorded as plain text, never as an integration."
      >
        <Input
          id="order-external-reference"
          value={externalReference}
          onChange={(event) => setExternalReference(event.target.value)}
        />
      </Field>

      <Field label="Customer" htmlFor="order-customer" hint="Optional. Type a name to search, or create one.">
        <CustomerPicker id="order-customer" initial={customer} onChange={setCustomer} canCreate={canCreateCustomer} />
      </Field>

      {source === "FIVERR" ? (
        <Field label="Fiverr account" htmlFor="order-fiverr-account" hint="Which of your Fiverr profiles this order came in on.">
          <select
            id="order-fiverr-account"
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

      <Field label="Order price" htmlFor="order-total-amount" hint="Optional — the whole order's price, not per item. Can be set later.">
        <Input
          id="order-total-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={totalAmount}
          onChange={(event) => setTotalAmount(event.target.value)}
        />
      </Field>

      <Field label="Deadline" htmlFor="order-deadline" hint="Optional. Required before the order can be processed.">
        <Input id="order-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </Field>

      <Field label="Notes" htmlFor="order-notes" hint="Optional.">
        <Textarea id="order-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending || (source === "FIVERR" && !fiverrAccountId)}>
        {pending ? "Creating…" : "Create order"}
      </Button>
    </form>
  );
}
