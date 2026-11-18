"use client";

import { Mail, MessageCircle, Phone, Plus, StickyNote, UserRound, UserRoundPlus, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createOutsourcedWorkerAction } from "@/lib/outsourced-workers/actions";
import { WORKER_NOTIFY_CHANNELS, type WorkerNotifyChannel } from "@/lib/outsourced-workers/notify-via";
import { cn } from "@/lib/utils";

/**
 * "New worker" as a popup on the Outsourced Workers list (owner request,
 * 2026-11-18), replacing the flat /outsourced-workers/new page (which now
 * opens this). Identity first, then how to reach them, then how new tasks are
 * sent; notes are optional. On success it goes to the worker's page, where
 * rates and portal access are set up.
 */

const SHEET =
  "mx-0 mb-0 mt-auto max-h-[94dvh] w-full max-w-none overflow-y-auto rounded-t-[14px] border border-zinc-200 bg-white p-0 text-ink shadow-xl shadow-zinc-900/10 backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px] " +
  "sm:m-auto sm:max-w-[520px] sm:rounded-[12px]";

const SEND_BY: Record<WorkerNotifyChannel, { label: string; hint: string }> = {
  BOTH: { label: "Both", hint: "Email + WhatsApp" },
  EMAIL: { label: "Email", hint: "Sent by the app" },
  WHATSAPP: { label: "WhatsApp", hint: "One tap to send" },
  NONE: { label: "Don't send", hint: "Tell them yourself" },
};

export function AddWorkerButton({ openOnLoad = false }: { openOnLoad?: boolean }) {
  const [open, setOpen] = useState(openOnLoad);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const close = () => {
    setOpen(false);
    // Opened from /outsourced-workers/new (?new=1): drop the flag so a refresh doesn't reopen it.
    if (params.get("new")) router.replace(pathname, { scroll: false });
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New worker
      </Button>
      <Modal open={open} onClose={close} labelledBy="add-worker-title" className={SHEET}>
        {open ? <AddWorkerForm onClose={close} /> : null}
      </Modal>
    </>
  );
}

function AddWorkerForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const [notifyVia, setNotifyVia] = useState<WorkerNotifyChannel>("BOTH");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();

  const whatsapp = sameAsPhone ? phone : whatsappNumber;
  const needsEmail = (notifyVia === "EMAIL" || notifyVia === "BOTH") && !email.trim();
  const needsNumber = (notifyVia === "WHATSAPP" || notifyVia === "BOTH") && !whatsapp.trim() && !phone.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createOutsourcedWorkerAction({
        name,
        email: email || undefined,
        phone: phone || undefined,
        whatsappNumber: whatsapp || undefined,
        notes: notes || undefined,
        notifyVia,
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
    <form onSubmit={submit} noValidate className="flex max-h-[94dvh] flex-col">
      <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <UserRoundPlus aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="add-worker-title" className="text-[16px] font-semibold text-zinc-900">
            New outsourced worker
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">Someone who fulfils order items for you. You can give them a portal login afterwards.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-[8px] p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        <IconField label="Name" htmlFor={`${id}-name`} icon={<UserRound />}>
          <Input id={`${id}-name`} required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name or business name" maxLength={160} className="pl-9" />
        </IconField>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Contact</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <IconField label="Email" htmlFor={`${id}-email`} icon={<Mail />} optional>
              <Input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="pl-9" />
            </IconField>
            <IconField label="Phone" htmlFor={`${id}-phone`} icon={<Phone />} optional>
              <Input id={`${id}-phone`} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 1234567" className="pl-9" />
            </IconField>
          </div>
          <IconField
            label="WhatsApp number"
            htmlFor={`${id}-whatsapp`}
            icon={<MessageCircle />}
            optional
            aside={
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
                <input type="checkbox" checked={sameAsPhone} onChange={(e) => setSameAsPhone(e.target.checked)} className="size-3.5 rounded border-zinc-300 accent-indigo-600" />
                Same as phone
              </label>
            }
          >
            <Input
              id={`${id}-whatsapp`}
              inputMode="tel"
              value={whatsapp}
              disabled={sameAsPhone}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+92 300 1234567"
              className="pl-9"
            />
          </IconField>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Send new tasks by</legend>
          <div role="radiogroup" aria-label="Send new tasks by" className="grid grid-cols-2 gap-2">
            {WORKER_NOTIFY_CHANNELS.map((channel) => {
              const selected = notifyVia === channel;
              return (
                <button
                  key={channel}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setNotifyVia(channel)}
                  className={cn(
                    "rounded-[8px] border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20",
                    selected ? "border-indigo-400 bg-indigo-50/70 ring-1 ring-inset ring-indigo-400" : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                  )}
                >
                  <span className={cn("block text-[13px] font-medium", selected ? "text-indigo-900" : "text-zinc-800")}>{SEND_BY[channel].label}</span>
                  <span className="block text-[11px] text-zinc-500">{SEND_BY[channel].hint}</span>
                </button>
              );
            })}
          </div>
          {/* Only once they've started filling it in, so the empty form doesn't open with a warning. */}
          {name.trim() && (needsEmail || needsNumber) ? (
            <p className="mt-2 text-xs text-amber-700">
              {needsEmail && needsNumber
                ? "Add an email and a WhatsApp number, or tasks can't reach them that way."
                : needsEmail
                  ? "Add an email, or the email won't be sent."
                  : "Add a WhatsApp or phone number, or WhatsApp won't be offered."}
            </p>
          ) : null}
        </fieldset>

        <IconField label="Notes" htmlFor={`${id}-notes`} icon={<StickyNote />} optional iconTop>
          <Textarea id={`${id}-notes`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment details, what they're good at…" className="pl-9" />
        </IconField>

        {error ? (
          <p role="alert" className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/70 px-5 py-3.5 sm:px-6">
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Adding…" : "Add worker"}
        </Button>
      </div>
    </form>
  );
}

/** A labelled input with an icon inside it at the start. */
function IconField({
  label,
  htmlFor,
  icon,
  optional = false,
  aside,
  iconTop = false,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: ReactNode;
  optional?: boolean;
  aside?: ReactNode;
  iconTop?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-zinc-800">
          {label}
          {optional ? <span className="ml-1 font-normal text-zinc-400">(optional)</span> : null}
        </label>
        {aside}
      </div>
      <div className="relative">
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3 text-zinc-400 [&_svg]:size-4",
            iconTop ? "top-2.5" : "top-1/2 -translate-y-1/2",
          )}
        >
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}
