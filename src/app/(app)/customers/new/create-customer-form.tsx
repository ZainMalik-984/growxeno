"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createCustomerAction } from "@/lib/customers/actions";

export function CreateCustomerForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createCustomerAction({
        name,
        type,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      });
      if (result.ok) {
        toast.success(result.message);
        router.push(`/customers/${result.customerId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5" noValidate>
      <Field label="Name" htmlFor="customer-name">
        <Input id="customer-name" required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="Type" htmlFor="customer-type">
        <select
          id="customer-type"
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
          className="h-9 w-full rounded-[8px] border border-zinc-200 bg-white px-3 text-[13px] text-ink shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:border-zinc-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
        >
          <option value="INDIVIDUAL">Individual</option>
          <option value="COMPANY">Company</option>
        </select>
      </Field>

      <Field label="Email" htmlFor="customer-email" hint="Optional.">
        <Input id="customer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>

      <Field label="Phone" htmlFor="customer-phone" hint="Optional.">
        <Input id="customer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>

      <Field label="Notes" htmlFor="customer-notes" hint="Optional.">
        <Textarea id="customer-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
        {pending ? "Creating…" : "Create customer"}
      </Button>
    </form>
  );
}
