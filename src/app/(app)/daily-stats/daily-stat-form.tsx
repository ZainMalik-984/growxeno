"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createDailyStatAction, updateDailyStatAction } from "@/lib/daily-stats/actions";
import type { DailyStatRow } from "@/lib/daily-stats/queries";
import { CURRENCIES } from "@/lib/finance/money";

type UserOption = { id: string; label: string };

const EMPTY_FORM = {
  userId: "",
  statDate: new Date().toISOString().slice(0, 10),
  orders: "0",
  completed: "0",
  pending: "0",
  revenue: "0",
  revenueCurrency: "USD",
  notes: "",
};

/** The single add/edit dialog, plus the button that opens it for a new entry. */
export function DailyStatForm({ users, canCreate }: { users: readonly UserOption[]; canCreate: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {canCreate ? (
        <Button variant="primary" onClick={() => setOpen(true)}>
          Add entry
        </Button>
      ) : null}
      {open ? <DailyStatDialog users={users} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditDailyStatButton({ row, users }: { row: DailyStatRow; users: readonly UserOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open ? <DailyStatDialog row={row} users={users} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DailyStatDialog({
  row,
  users,
  onClose,
}: {
  row?: DailyStatRow;
  users: readonly UserOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(
    row
      ? {
          userId: row.userId,
          statDate: row.statDate.toISOString().slice(0, 10),
          orders: String(row.orders),
          completed: String(row.completed),
          pending: String(row.pending),
          revenue: row.revenue,
          revenueCurrency: row.revenueCurrency,
          notes: row.notes ?? "",
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    startTransition(async () => {
      const payload = {
        userId: form.userId,
        statDate: form.statDate,
        orders: form.orders,
        completed: form.completed,
        pending: form.pending,
        revenue: form.revenue,
        revenueCurrency: form.revenueCurrency,
        notes: form.notes || undefined,
      };
      const result = row
        ? await updateDailyStatAction({ id: row.id, ...payload })
        : await createDailyStatAction(payload);
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
    <Modal open onClose={onClose} labelledBy="daily-stat-dialog-title">
      <h2 id="daily-stat-dialog-title" className="text-[15px] font-medium text-ink-strong">
        {row ? "Edit entry" : "Add entry"}
      </h2>

      <div className="mt-5 space-y-4">
        <Field label="User" htmlFor="stat-user">
          <select
            id="stat-user"
            value={form.userId}
            onChange={(event) => setForm((c) => ({ ...c, userId: event.target.value }))}
            disabled={!!row}
            className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none disabled:opacity-50"
          >
            <option value="">Choose a user…</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date" htmlFor="stat-date">
          <Input
            id="stat-date"
            type="date"
            value={form.statDate}
            onChange={(event) => setForm((c) => ({ ...c, statDate: event.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Orders" htmlFor="stat-orders">
            <Input
              id="stat-orders"
              inputMode="numeric"
              value={form.orders}
              onChange={(event) => setForm((c) => ({ ...c, orders: event.target.value }))}
            />
          </Field>
          <Field label="Completed" htmlFor="stat-completed">
            <Input
              id="stat-completed"
              inputMode="numeric"
              value={form.completed}
              onChange={(event) => setForm((c) => ({ ...c, completed: event.target.value }))}
            />
          </Field>
          <Field label="Pending" htmlFor="stat-pending">
            <Input
              id="stat-pending"
              inputMode="numeric"
              value={form.pending}
              onChange={(event) => setForm((c) => ({ ...c, pending: event.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Revenue" htmlFor="stat-revenue">
            <Input
              id="stat-revenue"
              inputMode="decimal"
              value={form.revenue}
              onChange={(event) => setForm((c) => ({ ...c, revenue: event.target.value }))}
            />
          </Field>
          <Field label="Currency" htmlFor="stat-currency">
            <Select
              id="stat-currency"
              className="w-20"
              value={form.revenueCurrency}
              onChange={(event) => setForm((c) => ({ ...c, revenueCurrency: event.target.value }))}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notes" htmlFor="stat-notes" hint="Optional.">
          <Input id="stat-notes" value={form.notes} onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))} />
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
        <Button variant="primary" onClick={submit} disabled={pending || !form.userId || !form.statDate}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
