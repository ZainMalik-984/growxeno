"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal, SHEET_CLASS } from "@/components/ui/modal";
import { updateCustomerAction } from "@/lib/customers/actions";
import type { CustomerDetail } from "@/lib/customers/queries";
import { cn } from "@/lib/utils";
import { CustomerFields, customerPayload, type CustomerFieldValues } from "../customer-fields";

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
        <Modal open onClose={() => setOpen(false)} labelledBy="edit-customer-title" className={cn(SHEET_CLASS, "sm:max-w-md")}>
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
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
  const [values, setValues] = useState<CustomerFieldValues>({
    name: customer.name,
    // Shown empty when it is just the name, so changing the name carries it along (2026-11-15).
    username: customer.username === customer.name ? "" : customer.username,
    type: customer.type,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    whatsapp: customer.whatsappNumber ?? "",
    notes: customer.notes ?? "",
  });
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateCustomerAction({ customerId: customer.id, ...customerPayload(values) });
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
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <CustomerFields idPrefix="edit-customer" values={values} onChange={setValues} />
        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">
        <Button type="submit" variant="accent" size="sm" className="rounded-[8px]" disabled={pending || !values.name.trim()}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
