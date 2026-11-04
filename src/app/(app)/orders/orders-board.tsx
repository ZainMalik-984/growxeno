"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { OrderItemStatus } from "@/generated/prisma/client";
import { ITEM_STATUS_TONE } from "@/lib/orders/status-tone";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusDot } from "@/components/ui/status-dot";
import { changeOrderItemStatusAction } from "@/lib/orders/actions";
import { canTransitionItem, ORDER_ITEM_STATUS_LABELS } from "@/lib/orders/state-machine";
import { cn } from "@/lib/utils";

/**
 * Jira-style board (confirmed directly, 2026-10-08): "Board should be
 * complete with drag and drop, in the orders page there should be option
 * to view board or list." Columns are `OrderItemStatus`; cards are Order
 * Items, not whole orders — a single order can have cards in several
 * columns at once, which is the point.
 */

const COLUMNS: readonly OrderItemStatus[] = ["PENDING", "PROCESSING", "REFILL", "DONE", "CANCELLED"];

/** Shared with the rest of the app — see src/lib/orders/status-tone.ts. */
const COLUMN_TONE = ITEM_STATUS_TONE;

export type BoardCard = {
  id: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  assigneeLabel: string;
  status: OrderItemStatus;
  metricLabel: string | null;
  currentCount: number | null;
  targetCount: number | null;
  progressPercent: number | null;
  costLabel: string | null;
  /** False disables dragging entirely — e.g. no `orders.change_status`, or not this actor's item. */
  canDrag: boolean;
  /** Drives which columns are legal drop targets — see `canTransitionItem`. */
  asAssignedWorkerOnly: boolean;
  /** Cancelling an item already assigned to an External Worker needs the guided adjusted-cost flow on the order page, not a bare drag — see order-items-panel.tsx's identical rule. */
  requiresGuidedCancel: boolean;
};

function Column({ status, children }: { status: OrderItemStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-32 w-72 shrink-0 flex-col gap-2 rounded-[12px] bg-white/60 p-2 ring-1 ring-inset ring-zinc-200/80 transition",
        isOver && "bg-indigo-50/70 ring-2 ring-indigo-300",
      )}
    >
      {children}
    </div>
  );
}

function Card({ card }: { card: BoardCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !card.canDrag,
  });

  return (
    // The draggable region (role="button" + tabIndex from dnd-kit's
    // `attributes`) and the "Order #" link are SIBLINGS, not nested — a
    // link inside a button-role element is an axe `nested-interactive`
    // violation (ambiguous keyboard/screen-reader activation target),
    // confirmed during Playwright's a11y scan of this exact component.
    // `transform` moves the whole outer card so the link travels with it
    // visually, even though only the inner region is what dnd-kit tracks.
    <div
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined}
      className={cn(
        "rounded-[10px] border border-zinc-200/80 bg-white p-3 text-[13px]",
        "shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-shadow hover:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_6px_16px_-8px_rgba(16,24,40,0.18)]",
        isDragging && "shadow-[0_12px_32px_-8px_rgba(16,24,40,0.28)] ring-2 ring-indigo-300",
      )}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={cn(card.canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-80", isDragging && "opacity-50")}
      >
        <p className="font-medium leading-snug text-zinc-900">{card.serviceName}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
          <span
            aria-hidden="true"
            className="grid size-4 place-items-center rounded-full bg-zinc-100 text-[9px] font-semibold uppercase text-zinc-600"
          >
            {card.assigneeLabel.charAt(0)}
          </span>
          {card.assigneeLabel}
        </p>
        {card.metricLabel && card.progressPercent !== null ? (
          <div className="mt-2.5 rounded-[8px] bg-zinc-50 px-2.5 py-2 ring-1 ring-inset ring-zinc-200/60">
            <div className="flex items-center justify-between text-xs">
              <span className="tabular-nums text-zinc-600">
                {(card.currentCount ?? 0).toLocaleString("en-US")} / {(card.targetCount ?? 0).toLocaleString("en-US")} {card.metricLabel}
              </span>
              <span className="tabular font-medium text-zinc-700">{card.progressPercent}%</span>
            </div>
            <ProgressBar percent={card.progressPercent} className="mt-1.5" />
          </div>
        ) : null}
        {card.costLabel ? <p className="mt-2 text-xs text-zinc-500">{card.costLabel}</p> : null}
      </div>
      <Link
        href={`/orders/${card.orderId}`}
        className="mt-2.5 inline-flex items-center rounded-[6px] bg-zinc-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700"
      >
        Order #{card.orderNumber}
      </Link>
    </div>
  );
}

export function OrdersBoard({ cards: initialCards }: { cards: BoardCard[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [cards, setCards] = useState(initialCards);
  // Resync after a server refetch (router.refresh() following a successful
  // move, or the owner editing filters/navigating back) — local state only
  // exists for the optimistic drag, never the source of truth. Setting
  // state during render (React's documented pattern for "adjust state when
  // a prop changes"), not in an effect, which would cost an extra render.
  const [prevInitialCards, setPrevInitialCards] = useState(initialCards);
  if (initialCards !== prevInitialCards) {
    setPrevInitialCards(initialCards);
    setCards(initialCards);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const move = (itemId: string, to: OrderItemStatus) => {
    startTransition(async () => {
      const result = await changeOrderItemStatusAction({ itemId, status: to });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
        setCards((current) => current.map((c) => (c.id === itemId ? { ...c, status: initialCards.find((i) => i.id === itemId)?.status ?? c.status } : c)));
      }
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const to = over.id as OrderItemStatus;
    const card = cards.find((c) => c.id === active.id);
    if (!card || card.status === to) return;

    if (!canTransitionItem(card.status, to, { asAssignedWorkerOnly: card.asAssignedWorkerOnly })) {
      toast.error(`Cannot move this item from ${ORDER_ITEM_STATUS_LABELS[card.status]} to ${ORDER_ITEM_STATUS_LABELS[to]}.`);
      return;
    }
    if (to === "CANCELLED" && card.requiresGuidedCancel) {
      toast("Cancelling this item needs the adjusted-cost flow — opening its order.");
      router.push(`/orders/${card.orderId}`);
      return;
    }

    setCards((current) => current.map((c) => (c.id === card.id ? { ...c, status: to } : c)));
    move(card.id, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div role="region" aria-label="Order items board" className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((status) => {
          const columnCards = cards.filter((c) => c.status === status);
          return (
            <Column key={status} status={status}>
              <div className="flex items-center justify-between px-1.5 pb-1 pt-1">
                <StatusDot tone={COLUMN_TONE[status]} label={ORDER_ITEM_STATUS_LABELS[status]} className="font-medium" />
                <span className="grid min-w-6 place-items-center rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-zinc-600">
                  {columnCards.length}
                </span>
              </div>
              {columnCards.length === 0 ? (
                <p className="rounded-[8px] border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-500">
                  No items
                </p>
              ) : null}
              {columnCards.map((card) => (
                <Card key={card.id} card={card} />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}
