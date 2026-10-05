"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createWorkerPaymentAction, deleteWorkerPaymentAction, updateWorkerPaymentAction } from "@/lib/finance/actions";
import { CURRENCIES } from "@/lib/finance/money";
import type { WorkerPaymentRow } from "@/lib/finance/queries";

type WorkerOption = { id: string; fullName: string };
type OutsourcedWorkerOption = { id: string; name: string };

const EMPTY_FORM = { workerValue: "", amount: "", currency: "PKR", paymentDate: new Date().toISOString().slice(0, 10), reference: "", notes: "" };

export function WorkerPaymentForm({
  workers,
  outsourcedWorkers,
  canCreate,
}: {
  workers: readonly WorkerOption[];
  outsourcedWorkers: readonly OutsourcedWorkerOption[];
  canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {canCreate ? (
        <Button variant="primary" onClick={() => setOpen(true)}>
          Add payment
        </Button>
      ) : null}
      {open ? <WorkerPaymentDialog workers={workers} outsourcedWorkers={outsourcedWorkers} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditWorkerPaymentButton({
  row,
  workers,
  outsourcedWorkers,
}: {
  row: WorkerPaymentRow;
  workers: readonly WorkerOption[];
  outsourcedWorkers: readonly OutsourcedWorkerOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open ? <WorkerPaymentDialog row={row} workers={workers} outsourcedWorkers={outsourcedWorkers} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function WorkerPaymentDialog({
  row,
  workers,
  outsourcedWorkers,
  onClose,
}: {
  row?: WorkerPaymentRow;
  workers: readonly WorkerOption[];
  outsourcedWorkers: readonly OutsourcedWorkerOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(
    row
      ? {
          workerValue: row.workerId ? `user:${row.workerId}` : `outsourced:${row.outsourcedWorkerId}`,
          amount: row.amount,
          currency: row.currency,
          paymentDate: row.paymentDate.toISOString().slice(0, 10),
          reference: row.reference ?? "",
          notes: row.notes ?? "",
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    startTransition(async () => {
      const [kind, id] = form.workerValue ? form.workerValue.split(":") : [null, null];
      const payload = {
        workerId: kind === "user" ? id : null,
        outsourcedWorkerId: kind === "outsourced" ? id : null,
        amount: form.amount,
        currency: form.currency,
        paymentDate: form.paymentDate,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      };
      const result = row ? await updateWorkerPaymentAction({ id: row.id, ...payload }) : await createWorkerPaymentAction(payload);
      if (result.ok) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const remove = () => {
    if (!row) return;
    startTransition(async () => {
      const result = await deleteWorkerPaymentAction({ id: row.id });
      if (result.ok) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Modal open onClose={onClose} labelledBy="worker-payment-dialog-title">
      <h2 id="worker-payment-dialog-title" className="text-[15px] font-medium text-ink-strong">
        {row ? "Edit payment" : "Add payment"}
      </h2>

      <div className="mt-5 space-y-4">
        <Field label="Worker" htmlFor="payment-worker">
          <select
            id="payment-worker"
            value={form.workerValue}
            onChange={(e) => setForm((c) => ({ ...c, workerValue: e.target.value }))}
            className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
          >
            <option value="">Choose a worker…</option>
            {workers.map((w) => (
              <option key={w.id} value={`user:${w.id}`}>
                {w.fullName}
              </option>
            ))}
            {outsourcedWorkers.map((w) => (
              <option key={w.id} value={`outsourced:${w.id}`}>
                {w.name} (outsourced)
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Amount" htmlFor="payment-amount">
            <Input id="payment-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} />
          </Field>
          <Field label="Currency" htmlFor="payment-currency">
            <Select id="payment-currency" className="w-20" value={form.currency} onChange={(e) => setForm((c) => ({ ...c, currency: e.target.value }))}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Date" htmlFor="payment-date">
          <Input id="payment-date" type="date" value={form.paymentDate} onChange={(e) => setForm((c) => ({ ...c, paymentDate: e.target.value }))} />
        </Field>

        <Field label="Reference" htmlFor="payment-reference" hint="Optional.">
          <Input id="payment-reference" value={form.reference} onChange={(e) => setForm((c) => ({ ...c, reference: e.target.value }))} />
        </Field>

        <Field label="Notes" htmlFor="payment-notes" hint="Optional.">
          <Input id="payment-notes" value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
        </Field>

        {error ? (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        {row ? (
          <Button variant="dangerGhost" onClick={remove} disabled={pending}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={pending || !form.workerValue || !form.amount.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
