"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createOutsourcedWorkerAction } from "@/lib/outsourced-workers/actions";

export function CreateOutsourcedWorkerForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createOutsourcedWorkerAction({
        name,
        email: email || undefined,
        phone: phone || undefined,
        whatsappNumber: whatsappNumber || undefined,
        notes: notes || undefined,
      });
      if (result.ok) {
        toast.success(result.message);
        router.push(`/outsourced-workers/${result.workerId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5" noValidate>
      <Field label="Name" htmlFor="worker-name">
        <Input id="worker-name" required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="Email" htmlFor="worker-email" hint="Optional.">
        <Input id="worker-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>

      <Field label="Phone" htmlFor="worker-phone" hint="Optional.">
        <Input id="worker-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>

      <Field label="WhatsApp number" htmlFor="worker-whatsapp" hint="Optional.">
        <Input id="worker-whatsapp" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} />
      </Field>

      <Field label="Notes" htmlFor="worker-notes" hint="Optional.">
        <Textarea id="worker-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
        {pending ? "Adding…" : "Add worker"}
      </Button>
    </form>
  );
}
