"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal, SHEET_CLASS } from "@/components/ui/modal";
import { updateCustomerAction } from "@/lib/customers/actions";
import type { CustomerDetail } from "@/lib/customers/queries";
import { cn } from "@/lib/utils";

/** "Edit" on the customer's page: the profile form in a popup (redesign, 2026-11-15). */
export function CustomerEditButton({ customer }: { customer: CustomerDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" className="rounded-[8px]" onClick={() => setOpen(true)}>
        <Pencil aria-hidden="true" className="size-3.5" />
        Edit
      </Button>
      {open ? (
        <Modal open onClose={() => setOpen(false)} labelledBy="edit-customer-title" className={cn(SHEET_CLASS, "sm:max-w-lg")}>
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
            <h2 id="edit-customer-title" className="text-[15px] font-semibold text-zinc-900">
              Edit customer
            </h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-[8px] p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <CustomerProfileForm customer={customer} onSaved={() => setOpen(false)} />
        </Modal>
      ) : null}
    </>
  );
}

export function CustomerProfileForm({ customer, onSaved }: { customer: CustomerDetail; onSaved?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(customer.name);
  // Shown empty when it is just the name, so changing the name carries it along (2026-11-15).
  const [username, setUsername] = useState(customer.username === customer.name ? "" : customer.username);
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">(customer.type);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateCustomerAction({
        customerId: customer.id,
        name,
        username: username || undefined,
        type,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      });
      if (result.ok) {
        toast.success(result.message);
        onSaved?.();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="edit-customer-name">
            <Input id="edit-customer-name" required value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Username" htmlFor="edit-customer-username" hint="Left empty, it's the name.">
            <Input id="edit-customer-username" value={username} placeholder={name || undefined} onChange={(event) => setUsername(event.target.value)} />
          </Field>
        </div>

        <Field label="Type" htmlFor="edit-customer-type">
          <select
            id="edit-customer-type"
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
            className="h-9 w-full rounded-[8px] border border-zinc-200 bg-white px-3 text-[13px] text-ink shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:border-zinc-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          >
            <option value="INDIVIDUAL">Individual</option>
            <option value="COMPANY">Company</option>
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="edit-customer-email" hint="Optional.">
            <Input id="edit-customer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="edit-customer-phone" hint="Optional.">
            <Input id="edit-customer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
        </div>

        <Field label="Notes" htmlFor="edit-customer-notes" hint="Optional.">
          <Textarea id="edit-customer-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        {error ? (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3.5 sm:px-6">
        <Button type="submit" variant="accent" size="sm" className="rounded-[8px]" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
