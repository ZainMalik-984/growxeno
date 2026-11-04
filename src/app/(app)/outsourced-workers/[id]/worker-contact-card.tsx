"use client";

import { Contact, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { OutsourcedWorkerDetail } from "@/lib/outsourced-workers/queries";
import { OutsourcedWorkerProfileForm } from "./outsourced-worker-profile-form";

/**
 * Contact details and notes, read-only by default with an Edit switch
 * (2026-11-03 redesign) — the page used to open on a tall always-editable
 * form. Editing uses the existing OutsourcedWorkerProfileForm unchanged.
 */
export function WorkerContactCard({ worker, canEdit }: { worker: OutsourcedWorkerDetail; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={Contact}
        tone="indigo"
        title="Contact & notes"
        actions={
          canEdit && !editing ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          ) : undefined
        }
      />

      {editing ? (
        <OutsourcedWorkerProfileForm worker={worker} canEdit onDone={() => setEditing(false)} />
      ) : (
        <dl className="-mt-2 divide-y divide-zinc-100">
          <Row label="Name">{worker.name}</Row>
          <Row label="Email">
            {worker.email ? (
              <a href={`mailto:${worker.email}`} className="break-all text-indigo-600 hover:underline">
                {worker.email}
              </a>
            ) : (
              <Muted>Not set</Muted>
            )}
          </Row>
          <Row label="Phone">
            {worker.phone ? (
              <a href={`tel:${worker.phone}`} className="text-indigo-600 hover:underline">
                {worker.phone}
              </a>
            ) : (
              <Muted>Not set</Muted>
            )}
          </Row>
          <Row label="WhatsApp">{worker.whatsappNumber ?? <Muted>Not set</Muted>}</Row>
          <div className="py-3 text-[13px]">
            <dt className="text-zinc-500">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-zinc-800">
              {worker.notes ?? <Muted>No notes yet.</Muted>}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-zinc-900">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="font-normal text-zinc-500">{children}</span>;
}
