"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { NotificationChannel, NotificationEvent } from "@/generated/prisma/client";
import { ALL_NOTIFICATION_CHANNELS, ALL_NOTIFICATION_EVENTS, TEMPLATE_VARIABLES } from "@/lib/notifications/events";
import { createTemplateAction, deleteTemplateAction, updateTemplateAction } from "@/lib/notifications/actions";
import type { TemplateRow } from "@/lib/notifications/queries";

const CHANNEL_LABELS: Record<NotificationChannel, string> = { IN_APP: "In-app", EMAIL: "Email", WHATSAPP: "WhatsApp" };

const EMPTY_FORM = {
  event: ALL_NOTIFICATION_EVENTS[0],
  channel: ALL_NOTIFICATION_CHANNELS[0],
  name: "",
  subject: "",
  body: "",
  requiredVariables: "",
  metaTemplateName: "",
  metaTemplateLanguage: "",
};

export function CreateTemplateButton({ eventLabels }: { eventLabels: Record<NotificationEvent, string> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        New template
      </Button>
      {open ? <TemplateDialog eventLabels={eventLabels} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditTemplateButton({
  row,
  eventLabels,
}: {
  row: TemplateRow;
  eventLabels: Record<NotificationEvent, string>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open ? <TemplateDialog row={row} eventLabels={eventLabels} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function TemplateDialog({
  row,
  eventLabels,
  onClose,
}: {
  row?: TemplateRow;
  eventLabels: Record<NotificationEvent, string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(
    row
      ? {
          event: row.event,
          channel: row.channel,
          name: row.name,
          subject: row.subject ?? "",
          body: row.body,
          requiredVariables: row.requiredVariables.join(", "),
          metaTemplateName: row.metaTemplateName ?? "",
          metaTemplateLanguage: row.metaTemplateLanguage ?? "",
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    startTransition(async () => {
      const payload = {
        event: form.event,
        channel: form.channel,
        name: form.name,
        subject: form.subject || undefined,
        body: form.body,
        requiredVariables: form.requiredVariables
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        metaTemplateName: form.metaTemplateName || undefined,
        metaTemplateLanguage: form.metaTemplateLanguage || undefined,
      };
      const result = row ? await updateTemplateAction({ id: row.id, ...payload }) : await createTemplateAction(payload);
      if (result.ok) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const remove = () => {
    if (!row) return;
    startTransition(async () => {
      const result = await deleteTemplateAction({ id: row.id });
      if (result.ok) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Modal open onClose={onClose} labelledBy="template-dialog-title">
      <h2 id="template-dialog-title" className="text-[15px] font-medium text-ink-strong">
        {row ? "Edit template" : "New template"}
      </h2>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Event" htmlFor="template-event">
            <select
              id="template-event"
              value={form.event}
              disabled={Boolean(row)}
              onChange={(e) => setForm((c) => ({ ...c, event: e.target.value as NotificationEvent }))}
              className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none disabled:bg-canvas-subtle"
            >
              {ALL_NOTIFICATION_EVENTS.map((event) => (
                <option key={event} value={event}>
                  {eventLabels[event]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Channel" htmlFor="template-channel">
            <select
              id="template-channel"
              value={form.channel}
              disabled={Boolean(row)}
              onChange={(e) => setForm((c) => ({ ...c, channel: e.target.value as NotificationChannel }))}
              className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none disabled:bg-canvas-subtle"
            >
              {ALL_NOTIFICATION_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {CHANNEL_LABELS[channel]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Name" htmlFor="template-name">
          <Input id="template-name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
        </Field>

        {form.channel === "EMAIL" ? (
          <Field label="Subject" htmlFor="template-subject" hint="Email only.">
            <Input id="template-subject" value={form.subject} onChange={(e) => setForm((c) => ({ ...c, subject: e.target.value }))} />
          </Field>
        ) : null}

        <Field
          label="Body"
          htmlFor="template-body"
          hint={`Variables: ${TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}`}
        >
          <Textarea id="template-body" rows={4} value={form.body} onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))} />
        </Field>

        <Field
          label="Required variables"
          htmlFor="template-required-variables"
          hint="Comma-separated. Each one must actually appear as {{...}} in the body above."
        >
          <Input
            id="template-required-variables"
            value={form.requiredVariables}
            onChange={(e) => setForm((c) => ({ ...c, requiredVariables: e.target.value }))}
          />
        </Field>

        {form.channel === "WHATSAPP" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta template name" htmlFor="template-meta-name" hint="Must be pre-approved by Meta.">
              <Input
                id="template-meta-name"
                value={form.metaTemplateName}
                onChange={(e) => setForm((c) => ({ ...c, metaTemplateName: e.target.value }))}
              />
            </Field>
            <Field label="Language" htmlFor="template-meta-language" hint="e.g. en_US">
              <Input
                id="template-meta-language"
                value={form.metaTemplateLanguage}
                onChange={(e) => setForm((c) => ({ ...c, metaTemplateLanguage: e.target.value }))}
              />
            </Field>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        {row ? (
          <Button variant="dangerGhost" onClick={remove} disabled={pending}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={pending || !form.name.trim() || !form.body.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
