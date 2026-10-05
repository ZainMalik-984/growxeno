"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { MetaList } from "@/components/ui/page";
import { updateCustomerAction } from "@/lib/customers/actions";
import type { CustomerDetail } from "@/lib/customers/queries";

export function CustomerProfileForm({
  customer,
  canEdit,
}: {
  customer: CustomerDetail;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(customer.name);
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">(customer.type);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [error, setError] = useState<string | undefined>();

  if (!canEdit) {
    return (
      <MetaList
        items={[
          { label: "Email", value: customer.email ?? <span className="text-ink-faint">—</span> },
          { label: "Phone", value: customer.phone ?? <span className="text-ink-faint">—</span> },
          { label: "Notes", value: customer.notes ?? <span className="text-ink-faint">—</span> },
        ]}
      />
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateCustomerAction({
        customerId: customer.id,
        name,
        type,
        email: email || undefined,
        phone: phone || undefined,
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
      <Field label="Name" htmlFor="edit-customer-name">
        <Input id="edit-customer-name" required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="Type" htmlFor="edit-customer-type">
        <select
          id="edit-customer-type"
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
          className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
        >
          <option value="INDIVIDUAL">Individual</option>
          <option value="COMPANY">Company</option>
        </select>
      </Field>

      <Field label="Email" htmlFor="edit-customer-email" hint="Optional.">
        <Input
          id="edit-customer-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field label="Phone" htmlFor="edit-customer-phone" hint="Optional.">
        <Input id="edit-customer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>

      <Field label="Notes" htmlFor="edit-customer-notes" hint="Optional.">
        <Textarea id="edit-customer-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={pending || !name.trim()}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
