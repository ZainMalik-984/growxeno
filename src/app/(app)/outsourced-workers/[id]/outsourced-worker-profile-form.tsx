"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { MetaList } from "@/components/ui/page";
import { updateOutsourcedWorkerAction } from "@/lib/outsourced-workers/actions";
import type { OutsourcedWorkerDetail } from "@/lib/outsourced-workers/queries";
import { WORKER_NOTIFY_CHANNELS, WORKER_NOTIFY_LABELS, type WorkerNotifyChannel } from "@/lib/outsourced-workers/notify-via";
import { cn } from "@/lib/utils";

export function OutsourcedWorkerProfileForm({
  worker,
  canEdit,
  onDone,
}: {
  worker: OutsourcedWorkerDetail;
  canEdit: boolean;
  /** Called after a successful save, or on Cancel — lets a read-only card switch back from edit mode. */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(worker.name);
  const [email, setEmail] = useState(worker.email ?? "");
  const [phone, setPhone] = useState(worker.phone ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(worker.whatsappNumber ?? "");
  const [notes, setNotes] = useState(worker.notes ?? "");
  const [notifyVia, setNotifyVia] = useState<WorkerNotifyChannel>(worker.notifyVia);
  const [error, setError] = useState<string | undefined>();

  if (!canEdit) {
    return (
      <MetaList
        items={[
          { label: "Email", value: worker.email ?? <span className="text-ink-faint">—</span> },
          { label: "Phone", value: worker.phone ?? <span className="text-ink-faint">—</span> },
          { label: "New tasks sent by", value: WORKER_NOTIFY_LABELS[worker.notifyVia] },
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
        notifyVia,
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        onDone?.();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" htmlFor="edit-worker-name">
        <Input id="edit-worker-name" required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Email" htmlFor="edit-worker-email" hint="Optional.">
        <Input id="edit-worker-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Field label="Phone" htmlFor="edit-worker-phone" hint="Optional.">
          <Input id="edit-worker-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="WhatsApp number" htmlFor="edit-worker-whatsapp" hint="Optional.">
          <Input id="edit-worker-whatsapp" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} />
        </Field>
      </div>
      <fieldset>
        <legend className="text-[13px] font-medium text-zinc-900">Send new tasks by</legend>
        <p className="mt-0.5 text-xs text-zinc-500">
          When a task is assigned, the details and an accept link go out this way. WhatsApp opens prefilled for you to send.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {WORKER_NOTIFY_CHANNELS.map((channel) => (
            <label
              key={channel}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 text-[13px] transition-colors",
                notifyVia === channel ? "border-indigo-300 bg-indigo-50/60 text-indigo-900" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50",
              )}
            >
              <input
                type="radio"
                name="notify-via"
                value={channel}
                checked={notifyVia === channel}
                onChange={() => setNotifyVia(channel)}
                className="size-3.5 accent-indigo-600"
              />
              {WORKER_NOTIFY_LABELS[channel]}
            </label>
          ))}
        </div>
        {notifyVia !== "NONE" && (notifyVia === "EMAIL" || notifyVia === "BOTH") && !email.trim() ? (
          <p className="mt-1.5 text-xs text-amber-700">Add an email address, or email will be skipped.</p>
        ) : null}
        {(notifyVia === "WHATSAPP" || notifyVia === "BOTH") && !whatsappNumber.trim() && !phone.trim() ? (
          <p className="mt-1.5 text-xs text-amber-700">Add a WhatsApp number, or WhatsApp will be skipped.</p>
        ) : null}
      </fieldset>
      <Field label="Notes" htmlFor="edit-worker-notes" hint="Optional.">
        <Textarea id="edit-worker-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
