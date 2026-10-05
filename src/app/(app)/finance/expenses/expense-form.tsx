"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createExpenseAction, updateExpenseAction } from "@/lib/finance/actions";
import { CURRENCIES } from "@/lib/finance/money";
import type { ExpenseRow } from "@/lib/finance/queries";

type CategoryOption = { id: string; name: string };
type UserOption = { id: string; fullName: string };

const EMPTY_FORM = {
  amount: "",
  currency: "USD",
  categoryId: "",
  date: new Date().toISOString().slice(0, 10),
  description: "",
  paidById: "",
  notes: "",
};

export function ExpenseForm({
  categories,
  users,
  canCreate,
  orderId,
}: {
  categories: readonly CategoryOption[];
  users: readonly UserOption[];
  canCreate: boolean;
  orderId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {canCreate ? (
        <Button variant="primary" onClick={() => setOpen(true)}>
          Add expense
        </Button>
      ) : null}
      {open ? <ExpenseDialog categories={categories} users={users} orderId={orderId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditExpenseButton({
  row,
  categories,
  users,
}: {
  row: ExpenseRow;
  categories: readonly CategoryOption[];
  users: readonly UserOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open ? <ExpenseDialog row={row} categories={categories} users={users} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ExpenseDialog({
  row,
  categories,
  users,
  orderId,
  onClose,
}: {
  row?: ExpenseRow;
  categories: readonly CategoryOption[];
  users: readonly UserOption[];
  orderId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(
    row
      ? {
          amount: row.amount,
          currency: row.currency,
          categoryId: row.categoryId,
          date: row.date.toISOString().slice(0, 10),
          description: row.description ?? "",
          paidById: "",
          notes: row.notes ?? "",
        }
      : { ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" },
  );
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    startTransition(async () => {
      const payload = {
        amount: form.amount,
        currency: form.currency,
        categoryId: form.categoryId,
        date: form.date,
        description: form.description || undefined,
        orderId: orderId ?? null,
        paidById: form.paidById || null,
        notes: form.notes || undefined,
      };
      const result = row ? await updateExpenseAction({ id: row.id, ...payload }) : await createExpenseAction(payload);
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
    <Modal open onClose={onClose} labelledBy="expense-dialog-title">
      <h2 id="expense-dialog-title" className="text-[15px] font-medium text-ink-strong">
        {row ? "Edit expense" : "Add expense"}
      </h2>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Amount" htmlFor="expense-amount">
            <Input id="expense-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} />
          </Field>
          <Field label="Currency" htmlFor="expense-currency">
            <Select id="expense-currency" className="w-20" value={form.currency} onChange={(e) => setForm((c) => ({ ...c, currency: e.target.value }))}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Category" htmlFor="expense-category">
          <select
            id="expense-category"
            value={form.categoryId}
            onChange={(e) => setForm((c) => ({ ...c, categoryId: e.target.value }))}
            className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
          >
            <option value="">Choose a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date" htmlFor="expense-date">
          <Input id="expense-date" type="date" value={form.date} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} />
        </Field>

        <Field label="Paid by" htmlFor="expense-paid-by" hint="Optional.">
          <select
            id="expense-paid-by"
            value={form.paidById}
            onChange={(e) => setForm((c) => ({ ...c, paidById: e.target.value }))}
            className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
          >
            <option value="">Not specified</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" htmlFor="expense-description" hint="Optional.">
          <Input id="expense-description" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
        </Field>

        <Field label="Notes" htmlFor="expense-notes" hint="Optional.">
          <Input id="expense-notes" value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
        </Field>

        {error ? (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={pending || !form.amount.trim() || !form.categoryId}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
