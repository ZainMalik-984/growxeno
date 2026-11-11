"use client";

import { ClipboardList, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DeadlineCountdown } from "@/components/ui/deadline";
import { Card, CardHeader, PHONE_FLUSH } from "@/components/ui/card";
import type { OrderDetail } from "@/lib/orders/queries";
import { cn } from "@/lib/utils";
import { OrderProfileForm } from "./order-profile-form";

/**
 * Order details, read-only by default with an Edit switch (2026-11-03
 * redesign) — the page used to open on a tall always-editable form. Values
 * arrive already redacted for this actor (src/lib/orders/visibility.ts);
 * `showPrice` / `showParties` decide whether a row exists at all, so a hidden
 * value is never labelled on the page either.
 */
export function OrderDetailsCard({
  order,
  fiverrAccounts,
  canEdit,
  canCreateCustomer,
  showPrice,
  showParties,
  showOrderDetails,
  finished,
  earningsLabel = null,
}: {
  order: OrderDetail;
  fiverrAccounts: ReadonlyArray<{ id: string; name: string }>;
  canEdit: boolean;
  canCreateCustomer: boolean;
  showPrice: boolean;
  showParties: boolean;
  /**
   * False for a worker: they see the deadline only, and it is already their
   * own item deadline (owner request, 2026-11-03 — see visibility.ts).
   */
  showOrderDetails: boolean;
  /** The order is completed, delivered or cancelled: no countdown. */
  finished: boolean;
  /** For a worker: what they earn from this order, e.g. "250.00 PKR". */
  earningsLabel?: string | null;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Card className={cn("p-5 sm:p-6", PHONE_FLUSH)}>
      <CardHeader
        icon={ClipboardList}
        tone="indigo"
        title="Order details"
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
        <OrderProfileForm
          order={order}
          fiverrAccounts={fiverrAccounts}
          canEdit
          canCreateCustomer={canCreateCustomer}
          onDone={() => setEditing(false)}
        />
      ) : (
        <dl className="-mt-2 divide-y divide-zinc-100">
          {showOrderDetails ? (
          <>
          <Row label="Source">
            {order.source === "FIVERR" ? "Fiverr" : "External"}
            {showParties && order.fiverrAccount ? (
              <span className="block text-xs font-normal text-zinc-500">{order.fiverrAccount.name}</span>
            ) : null}
          </Row>
          <Row label="Reference">{order.externalReference || <Muted>—</Muted>}</Row>
          </>
          ) : null}
          {showParties ? <Row label="Customer">{order.customer?.name ?? <Muted>Not linked</Muted>}</Row> : null}
          {showPrice ? (
            <Row label="Order price">
              <span className="tabular-nums">
                {order.totalAmount} {order.currency}
              </span>
            </Row>
          ) : null}
          {earningsLabel ? (
            <Row label="You earn">
              <span className="font-semibold tabular-nums text-emerald-700">{earningsLabel}</span>
            </Row>
          ) : null}
          <Row label="Deadline">
            {order.deadline ? (
              <DeadlineCountdown deadline={order.deadline} finished={finished} stacked />
            ) : showOrderDetails ? (
              <span className="font-normal text-amber-700">Not set · needed to process</span>
            ) : (
              <Muted>Not set yet</Muted>
            )}
          </Row>
          {showOrderDetails && order.notes ? (
            <div className="py-3 text-[13px]">
              <dt className="text-zinc-500">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-zinc-800">{order.notes}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-zinc-900">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="font-normal text-zinc-500">{children}</span>;
}
