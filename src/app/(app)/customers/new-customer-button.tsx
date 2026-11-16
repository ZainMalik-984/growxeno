"use client";

import { Plus, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal, SHEET_CLASS } from "@/components/ui/modal";
import { createCustomerAction } from "@/lib/customers/actions";
import { cn } from "@/lib/utils";
import { CustomerFields, customerPayload, EMPTY_CUSTOMER, type CustomerFieldValues } from "./customer-fields";

/**
 * "New customer" as a popup on the Customers page (owner request, 2026-11-16:
 * "simple and plain" instead of a separate flat page). `/customers/new` opens
 * it too (?new=1).
 */
export function NewCustomerButton({ defaultOpen = false, label = "New customer" }: { defaultOpen?: boolean; label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(defaultOpen);

  const close = () => {
    setOpen(false);
    // Drop ?new=1 so a refresh doesn't open it again.
    if (searchParams.has("new")) {
      const params = new URLSearchParams(searchParams);
      params.delete("new");
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    }
  };

  return (
    <>
      <Button variant="accent" size="sm" className="h-9 rounded-[8px] px-3.5" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" className="size-4" />
        {label}
      </Button>
      {open ? (
        <Modal open onClose={close} labelledBy="new-customer-title" className={cn(SHEET_CLASS, "sm:max-w-md")}>
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
            <h2 id="new-customer-title" className="text-[15px] font-semibold text-zinc-900">
              New customer
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="rounded-[8px] p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <CreateCustomerForm onCancel={close} />
        </Modal>
      ) : null}
    </>
  );
}

export function CreateCustomerForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<CustomerFieldValues>(EMPTY_CUSTOMER);
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createCustomerAction(customerPayload(values));
      if (result.ok) {
        toast.success(result.message);
        router.push(`/customers/${result.customerId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <CustomerFields idPrefix="customer" values={values} onChange={setValues} autoFocus />
        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">
        <Button type="button" variant="secondary" size="sm" className="rounded-[8px]" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="accent" size="sm" className="rounded-[8px]" disabled={pending || !values.name.trim()}>
          {pending ? "Creating…" : "Create customer"}
        </Button>
      </div>
    </form>
  );
}
