"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { MetaList } from "@/components/ui/page";
import { updateOutsourcedWorkerAction } from "@/lib/outsourced-workers/actions";
import type { OutsourcedWorkerDetail } from "@/lib/outsourced-workers/queries";

export function OutsourcedWorkerProfileForm({
  worker,
  canEdit,
}: {
  worker: OutsourcedWorkerDetail;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(worker.name);
  const [email, setEmail] = useState(worker.email ?? "");
  const [phone, setPhone] = useState(worker.phone ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(worker.whatsappNumber ?? "");
  const [notes, setNotes] = useState(worker.notes ?? "");
  const [error, setError] = useState<string | undefined>();

  if (!canEdit) {
    return (
      <MetaList
        items={[
          { label: "Email", value: worker.email ?? <span className="text-ink-faint">—</span> },
          { label: "Phone", value: worker.phone ?? <span className="text-ink-faint">—</span> },
          { label: "Notes", value: worker.notes ?? <span className="text-ink-faint">—</span> },
        ]}
      />
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateOutsourcedWorkerAction({
        workerId: worker.id,
        name,
        email: email || undefined,
        phone: phone || undefined,
        whatsappNumber: whatsappNumber || undefined,
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
      <Field label="Name" htmlFor="edit-worker-name">
        <Input id="edit-worker-name" required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Email" htmlFor="edit-worker-email" hint="Optional.">
        <Input id="edit-worker-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field label="Phone" htmlFor="edit-worker-phone" hint="Optional.">
        <Input id="edit-worker-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>
      <Field label="WhatsApp number" htmlFor="edit-worker-whatsapp" hint="Optional.">
        <Input id="edit-worker-whatsapp" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} />
      </Field>
      <Field label="Notes" htmlFor="edit-worker-notes" hint="Optional.">
        <Textarea id="edit-worker-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
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
