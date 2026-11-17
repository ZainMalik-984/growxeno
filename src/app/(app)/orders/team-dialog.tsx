"use client";

import { Check, ChevronDown, Clock, Lock, Plus, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CategoryThumb } from "@/components/catalog/category-thumb";
import { WhatsAppLink } from "@/components/team/share-bits";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import type { TeamShareView } from "@/lib/team/queries";
import { addTeamMemberAction, assignShareAction, removeShareAction, setShareStatusAction, updateShareAction } from "@/lib/team/actions";
import { formatCount, formatSpan, remainingToAllocate, requiredAmount, shareMessage, unitOf } from "@/lib/team/rules";
import { cn } from "@/lib/utils";

/**
 * The Team popup on a worker's task (owner request, 2026-11-17; made compact
 * the same day): split the task between the worker's own people, see each
 * part's progress and time, mark parts done, and message a member their part
 * on WhatsApp. Private to the worker.
 *
 * Layout: a slim header with the split summary and a thin bar, one row per
 * person (initials, name, time, inline progress, status, icon actions), and
 * the assign controls as a single footer row.
 */

export type TeamTask = {
  id: string;
  orderNumber: number;
  serviceName: string;
  /** The service's own name ("Subscribers") and its category's logo, for the header (2026-11-17). */
  serviceTitle?: string;
  categoryName?: string;
  categoryImageUrl?: string | null;
  metricType: ServiceMetricType | null;
  startingCount: number | null;
  targetCount: number | null;
  channelLink: string | null;
};

export type TeamMemberOption = { id: string; name: string; whatsappNumber: string | null };

/** One colour per person: the bar segment and their initials. */
const SWATCHES = [
  { bar: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  { bar: "bg-sky-500", chip: "bg-sky-50 text-sky-700 ring-sky-200" },
  { bar: "bg-violet-500", chip: "bg-violet-50 text-violet-700 ring-violet-200" },
  { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-700 ring-amber-200" },
  { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700 ring-rose-200" },
  { bar: "bg-teal-500", chip: "bg-teal-50 text-teal-700 ring-teal-200" },
] as const;

type Swatch = (typeof SWATCHES)[number];

const NEW_MEMBER = "__new__";

/** A bottom sheet on phones, a centred popup from sm, with tighter corners than the app's default sheet (2026-11-17). */
const TEAM_SHEET =
  "mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[12px] border border-zinc-200 bg-white p-0 text-ink shadow-xl shadow-zinc-900/10 backdrop:bg-zinc-950/30 " +
  "sm:m-auto sm:max-w-md sm:rounded-[10px]";

/** Inputs in this popup: a size smaller than the app's default. */
const FIELD = "h-8 rounded-[6px] text-[13px]";

const iconButton =
  "grid size-7 shrink-0 place-items-center rounded-[6px] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:opacity-40";

const stamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => stamp.format(new Date(iso));

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

export function TeamDialog({
  task,
  shares,
  members,
  onClose,
}: {
  task: TeamTask | null;
  shares: TeamShareView[];
  members: TeamMemberOption[];
  onClose: () => void;
}) {
  return (
    <Modal open={task !== null} onClose={onClose} labelledBy="team-dialog-title" className={TEAM_SHEET}>
      {task ? <TeamBody key={task.id} task={task} shares={shares} members={members} onClose={onClose} /> : null}
    </Modal>
  );
}

function TeamBody({ task, shares, members, onClose }: { task: TeamTask; shares: TeamShareView[]; members: TeamMemberOption[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [now] = useState(() => new Date());
  const required = requiredAmount(task);
  const unit = unitOf(task);
  const remaining = remainingToAllocate(task, shares);
  const assigned = shares.reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const doneCount = shares.filter((s) => s.status === "DONE").length;
  const swatchOf = (memberId: string): Swatch => SWATCHES[Math.max(0, shares.findIndex((s) => s.memberId === memberId)) % SWATCHES.length]!;

  // Anyone can take another part of the same task (2026-11-17); the picker starts on someone not on it yet.
  const notOnTask = members.filter((m) => !shares.some((s) => s.memberId === m.id));
  const [memberId, setMemberId] = useState(notOnTask[0]?.id ?? members[0]?.id ?? NEW_MEMBER);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [amount, setAmount] = useState(remaining !== null && remaining > 0 ? String(remaining) : "");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAssigned, setJustAssigned] = useState<{ name: string; number: string | null; text: string } | null>(null);

  const run = (work: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const result = await work();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });

  const assign = () =>
    start(async () => {
      setError(null);
      let id = memberId;
      let name = members.find((m) => m.id === memberId)?.name ?? "";
      let number = members.find((m) => m.id === memberId)?.whatsappNumber ?? null;
      if (memberId === NEW_MEMBER) {
        const added = await addTeamMemberAction({ name: newName, whatsappNumber: newNumber });
        if (!added.ok || !added.memberId) {
          setError(added.ok ? "Couldn't add them." : added.error);
          return;
        }
        id = added.memberId;
        name = newName.trim();
        number = newNumber.trim() || null;
      }
      // Optional on a task without a count (owner request, 2026-11-17), required otherwise.
      const cleaned = amount.replace(/[,\s]/g, "");
      const parsedAmount = required === null && !cleaned ? null : Number(cleaned);
      const result = await assignShareAction({ itemId: task.id, memberId: id, amount: parsedAmount, note: note || null });
      if (!result.ok) {
        setError(result.error);
        router.refresh();
        return;
      }
      toast.success(`Assigned to ${name}.`);
      setJustAssigned({ name, number, text: shareMessage({ ...task, memberName: name, amount: parsedAmount, note: note || null }) });
      setNewName("");
      setNewNumber("");
      setNote("");
      setShowNote(false);
      const left = remaining === null || parsedAmount === null ? null : remaining - parsedAmount;
      setAmount(left !== null && left > 0 ? String(left) : "");
      // Next member not on the task yet, otherwise the same person again.
      setMemberId(notOnTask.find((m) => m.id !== id)?.id ?? id);
      router.refresh();
    });

  const canAssign = required === null || (remaining ?? 0) > 0;
  const peopleCount = new Set(shares.map((s) => s.memberId)).size;
  const people = `${peopleCount} ${peopleCount === 1 ? "person" : "people"}${shares.length > peopleCount ? ` · ${shares.length} parts` : ""}`;

  return (
    <div className="flex max-h-[92dvh] flex-col">
      {/* Header: what the task is, and how it's split. */}
      <div className="border-b border-zinc-100 px-4 pb-3 pt-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {task.categoryName ? <CategoryThumb name={task.categoryName} imageUrl={task.categoryImageUrl ?? null} size={28} className="rounded-[6px]" /> : null}
            <div className="min-w-0">
              <h2 id="team-dialog-title" className="truncate text-[14px] font-semibold leading-tight text-zinc-900">
                {task.serviceTitle ?? task.serviceName}
              </h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">Team · Order #{task.orderNumber}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={cn(iconButton, "-mr-2 -mt-1")}>
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-3 text-xs tabular-nums">
          <span className="text-zinc-500">
            {people}
            {doneCount > 0 ? ` · ${doneCount} done` : ""}
          </span>
          {required !== null && required > 0 ? (
            <span className="text-zinc-500">
              <span className="font-semibold text-zinc-900">{formatCount(assigned)}</span> / {formatCount(required)} {unit} assigned
            </span>
          ) : assigned > 0 ? (
            <span className="text-zinc-500">
              <span className="font-semibold text-zinc-900">{formatCount(assigned)}</span> given out
            </span>
          ) : null}
        </div>
        {required !== null && required > 0 ? (
          <div className="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full bg-zinc-100" aria-hidden>
            {shares.map((s) => (
              <span
                key={s.id}
                className={cn("h-full first:rounded-l-full", swatchOf(s.memberId).bar, s.status === "DONE" && "opacity-40")}
                style={{ width: `${((s.amount ?? 0) / required) * 100}%` }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* One row per person. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shares.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-zinc-500">No one on this task yet. Hand part of it to someone below.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {shares.map((s) => (
              <ShareRow
                key={`${s.id}:${s.done}:${s.status}`}
                share={s}
                task={task}
                unit={unit}
                swatch={swatchOf(s.memberId)}
                now={now}
                pending={pending}
                onDone={(done) => run(() => updateShareAction({ shareId: s.id, done }))}
                onStatus={(status) => run(() => setShareStatusAction({ shareId: s.id, status }))}
                onRemove={() => run(() => removeShareAction({ shareId: s.id }))}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Assign: one row, extras only when needed. */}
      <div className="border-t border-zinc-100 bg-zinc-50/70 px-4 py-3 sm:px-5">
        {justAssigned && justAssigned.number ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-[6px] border border-emerald-200/70 bg-emerald-50/70 py-1 pl-2.5 pr-1">
            <p className="min-w-0 truncate text-[13px] text-emerald-800">Let {justAssigned.name.split(/\s+/)[0]} know</p>
            <WhatsAppLink number={justAssigned.number} text={justAssigned.text} label={`Send ${justAssigned.name} their part on WhatsApp`} className="h-7 rounded-[6px] bg-white shadow-sm">
              Send on WhatsApp
            </WhatsAppLink>
          </div>
        ) : null}

        {canAssign ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              assign();
            }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <Select aria-label="Team member" value={memberId} onChange={(e) => setMemberId(e.target.value)} className={cn(FIELD, "min-w-0 flex-1 bg-white")}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value={NEW_MEMBER}>+ New member…</option>
              </Select>
              <Input
                aria-label={required !== null ? `Amount${unit ? ` (${unit})` : ""}` : "Amount (optional)"}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={required !== null ? "Amount" : "Amount (optional)"}
                className={cn(FIELD, "w-20 bg-white text-right tabular-nums sm:w-24")}
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="h-8 rounded-[6px] px-3"
                disabled={pending || (memberId === NEW_MEMBER && !newName.trim()) || (required !== null && !amount.trim())}
              >
                Assign
              </Button>
            </div>
            {memberId === NEW_MEMBER ? (
              <div className="grid grid-cols-2 gap-2">
                <Input aria-label="New member's name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" maxLength={160} className={cn(FIELD, "bg-white")} />
                <Input aria-label="New member's WhatsApp number" value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="WhatsApp (optional)" inputMode="tel" maxLength={32} className={cn(FIELD, "bg-white")} />
              </div>
            ) : null}
            {showNote ? (
              <Input aria-label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for them (optional)" maxLength={500} className={cn(FIELD, "bg-white")} autoFocus />
            ) : (
              <button type="button" onClick={() => setShowNote(true)} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800">
                <Plus aria-hidden className="size-3" /> Add note
              </button>
            )}
            {error ? (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="text-xs text-zinc-500">Fully assigned. Remove someone to hand their part to someone else.</p>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Lock aria-hidden className="size-3 shrink-0" />
          Private to you. Admins can&apos;t see your team, their numbers or how you split tasks.
        </p>
      </div>
    </div>
  );
}

const dayStamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/**
 * One part of the task. Collapsed (2026-11-17, owner request): who, how long
 * they've had it (or the day it was completed), their progress and a quick
 * tick, so a row is one line even on a phone. Tapped: the details, with the
 * exact times, the note, progress to edit, WhatsApp and Remove.
 */
function ShareRow({
  share: s,
  task,
  unit,
  swatch,
  now,
  pending,
  onDone,
  onStatus,
  onRemove,
}: {
  share: TeamShareView;
  task: TeamTask;
  unit: string | null;
  swatch: Swatch;
  now: Date;
  pending: boolean;
  onDone: (done: number) => void;
  onStatus: (status: "DONE" | "PROCESSING") => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(String(s.done));
  const isDone = s.status === "DONE";
  const detailsId = `share-${s.id}`;
  const commit = () => {
    const n = Number(done.replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n === s.done) return setDone(String(s.done));
    onDone(n);
  };
  const hasNumber = Boolean(s.memberWhatsapp && /\d/.test(s.memberWhatsapp));

  return (
    <li className={cn(isDone && "bg-zinc-50/60")}>
      <div className="flex items-center gap-1.5 pr-2.5 sm:pr-3.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-indigo-500/20 sm:pl-5"
        >
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold ring-1 ring-inset", swatch.chip, isDone && "opacity-60")}>
            {isDone ? <Check aria-hidden className="size-3.5" /> : initials(s.memberName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-[13px] font-medium", isDone ? "text-zinc-500" : "text-zinc-900")}>{s.memberName}</span>
            <span className="block truncate text-[11px] tabular-nums text-zinc-500">
              {isDone && s.finishedAt ? (
                <span className="text-emerald-700">Completed {dayStamp.format(new Date(s.finishedAt))}</span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden className="size-3" />
                  {formatSpan(now.getTime() - new Date(s.assignedAt).getTime())}
                </span>
              )}
            </span>
          </span>
          {s.amount !== null ? (
            <span className="shrink-0 text-xs tabular-nums text-zinc-500">
              {isDone ? formatCount(s.amount) : `${formatCount(s.done)} / ${formatCount(s.amount)}`}
            </span>
          ) : null}
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-zinc-300 transition-transform", open && "rotate-180")} />
        </button>
        <button
          type="button"
          onClick={() => onStatus(isDone ? "PROCESSING" : "DONE")}
          disabled={pending}
          aria-label={isDone ? "Reopen" : "Mark done"}
          title={isDone ? "Reopen" : "Mark done"}
          className={cn(iconButton, !isDone && "text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700")}
        >
          {isDone ? <RotateCcw aria-hidden className="size-4" /> : <Check aria-hidden className="size-4" />}
        </button>
      </div>

      {open ? (
        <div id={detailsId} className="mx-4 mb-2.5 rounded-[6px] border border-zinc-200/80 bg-white p-2.5 sm:mx-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-zinc-400">Assigned</dt>
              <dd className="mt-0.5 tabular-nums text-zinc-800">{when(s.assignedAt)}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">{isDone ? "Completed" : "Status"}</dt>
              <dd className={cn("mt-0.5 tabular-nums", isDone ? "text-emerald-700" : "text-zinc-800")}>
                {isDone && s.finishedAt ? when(s.finishedAt) : "Processing"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400">{isDone ? "Time taken" : "Assigned for"}</dt>
              <dd className="mt-0.5 tabular-nums text-zinc-800">
                {isDone && s.finishedAt
                  ? formatSpan(new Date(s.finishedAt).getTime() - new Date(s.assignedAt).getTime())
                  : formatSpan(now.getTime() - new Date(s.assignedAt).getTime())}
              </dd>
            </div>
            {s.amount !== null ? (
              <div>
                <dt className="text-zinc-400">Done so far</dt>
                <dd className="mt-0.5 flex items-center gap-1 tabular-nums text-zinc-800">
                  {isDone ? (
                    `${formatCount(s.amount)}${unit ? ` ${unit}` : ""}`
                  ) : (
                    <>
                      <input
                        aria-label={`Done so far by ${s.memberName}`}
                        value={done}
                        onChange={(e) => setDone(e.target.value)}
                        onBlur={commit}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
                        inputMode="numeric"
                        className="h-6 w-16 rounded-[5px] border border-zinc-200 bg-white px-1.5 text-right text-xs text-zinc-900 transition-colors hover:border-zinc-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                      />
                      <span className="text-zinc-500">/ {formatCount(s.amount)}</span>
                    </>
                  )}
                </dd>
              </div>
            ) : null}
            {s.note ? (
              <div className="col-span-2">
                <dt className="text-zinc-400">Note</dt>
                <dd className="mt-0.5 break-words text-zinc-800">{s.note}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-2.5">
            {hasNumber ? (
              <WhatsAppLink
                number={s.memberWhatsapp}
                label={`Send ${s.memberName} their part on WhatsApp`}
                text={shareMessage({ ...task, memberName: s.memberName, amount: s.amount, note: s.note })}
                className="h-7 rounded-[6px]"
              >
                WhatsApp
              </WhatsAppLink>
            ) : null}
            <Button size="sm" variant="dangerGhost" disabled={pending} onClick={onRemove} className="ml-auto h-7 rounded-[6px] px-2.5" aria-label={`Remove ${s.memberName} from this task`}>
              Remove
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
