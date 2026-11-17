"use client";

import { ChevronRight, Lock, Pencil, Plus, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { ShareStatusPill, WhatsAppLink } from "@/components/team/share-bits";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader, SURFACE_CLASS } from "@/components/ui/page";
import type { MemberShareView, TeamMemberView } from "@/lib/team/queries";
import { addTeamMemberAction, getMemberWorkAction, setShareStatusAction, setTeamMemberActiveAction, updateTeamMemberAction } from "@/lib/team/actions";
import { formatCount, shareDuration, shareMessage, unitOf } from "@/lib/team/rules";
import { cn } from "@/lib/utils";

const stamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => stamp.format(new Date(iso));
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const WIDE_MODAL =
  "m-auto w-full max-w-lg rounded-[14px] border border-zinc-200/80 bg-white p-0 text-ink shadow-[0_24px_64px_-16px_rgba(16,24,40,0.35)] backdrop:bg-zinc-950/30";

/**
 * My team (2026-11-17): one minimal list of the worker's people. Everything
 * happens in popups: add or edit a member, and open a member to see and
 * finish their work.
 */
export function TeamPanel({ members }: { members: TeamMemberView[] }) {
  const [editing, setEditing] = useState<TeamMemberView | "new" | null>(null);
  const [viewing, setViewing] = useState<TeamMemberView | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const active = members.filter((m) => m.isActive);
  const inactive = members.filter((m) => !m.isActive);

  return (
    <>
      <PageHeader
        title="My team"
        description={
          <>
            The people who work with you. Split a task between them from its Team button on Orders.
            <span className="mt-1.5 flex items-center gap-1.5 text-zinc-400">
              <Lock aria-hidden className="size-3 shrink-0" />
              Private to you. Admins can&apos;t see your team, their numbers or how you split tasks.
            </span>
          </>
        }
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Add member
          </Button>
        }
      />

      {members.length === 0 ? (
        <div className={cn(SURFACE_CLASS, "flex flex-col items-center px-6 py-14 text-center")}>
          <span className="grid size-11 place-items-center rounded-full bg-zinc-100 text-zinc-500">
            <UserRound aria-hidden className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-zinc-900">No team members yet</p>
          <p className="mt-1 max-w-sm text-[13px] text-zinc-500">Add the people who help you, then hand them parts of your tasks.</p>
          <Button variant="primary" className="mt-5" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Add member
          </Button>
        </div>
      ) : (
        <>
          <MemberList members={active} onOpen={setViewing} onEdit={setEditing} />
          {inactive.length > 0 ? (
            <div className="mt-4">
              <button type="button" onClick={() => setShowInactive((v) => !v)} className="text-[13px] font-medium text-zinc-500 hover:text-zinc-800">
                {showInactive ? "Hide inactive" : `Show inactive (${inactive.length})`}
              </button>
              {showInactive ? <MemberList members={inactive} onOpen={setViewing} onEdit={setEditing} className="mt-2" /> : null}
            </div>
          ) : null}
        </>
      )}

      <MemberDialog member={editing} onClose={() => setEditing(null)} />
      <MemberWorkDialog member={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function MemberList({
  members,
  onOpen,
  onEdit,
  className,
}: {
  members: TeamMemberView[];
  onOpen: (m: TeamMemberView) => void;
  onEdit: (m: TeamMemberView) => void;
  className?: string;
}) {
  if (members.length === 0) return null;
  return (
    <ul className={cn(SURFACE_CLASS, "divide-y divide-zinc-100", className)}>
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-1 pr-2">
          <button
            type="button"
            onClick={() => onOpen(m)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20"
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold",
                m.isActive ? "bg-indigo-50 text-indigo-700" : "bg-zinc-100 text-zinc-400",
              )}
            >
              {initials(m.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm font-medium", m.isActive ? "text-zinc-900" : "text-zinc-500")}>{m.name}</span>
              <span className="block text-xs text-zinc-500">
                {m.processing} processing · {m.done} done
              </span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-zinc-300" />
          </button>
          <WhatsAppLink number={m.whatsappNumber} label={`WhatsApp ${m.name}`} />
          <Button variant="ghost" size="sm" aria-label={`Edit ${m.name}`} onClick={() => onEdit(m)} className="size-8 px-0">
            <Pencil aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** Add a member, or edit one (with deactivate / reactivate). The form remounts per member. */
function MemberDialog({ member, onClose }: { member: TeamMemberView | "new" | null; onClose: () => void }) {
  const titleId = useId();
  return (
    <Modal open={member !== null} onClose={onClose} labelledBy={titleId}>
      {member ? <MemberForm key={member === "new" ? "new" : member.id} member={member} titleId={titleId} onClose={onClose} /> : null}
    </Modal>
  );
}

function MemberForm({ member, titleId, onClose }: { member: TeamMemberView | "new"; titleId: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const existing = member === "new" ? null : member;
  const [name, setName] = useState(existing?.name ?? "");
  const [number, setNumber] = useState(existing?.whatsappNumber ?? "");
  const [error, setError] = useState<string | null>(null);

  const finish = (result: { ok: true; message: string } | { ok: false; error: string }) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(result.message);
    onClose();
    router.refresh();
  };

  const save = () =>
    start(async () => {
      finish(
        existing
          ? await updateTeamMemberAction({ memberId: existing.id, name, whatsappNumber: number })
          : await addTeamMemberAction({ name, whatsappNumber: number }),
      );
    });

  const toggleActive = () =>
    start(async () => {
      if (existing) finish(await setTeamMemberActiveAction({ memberId: existing.id, isActive: !existing.isActive }));
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4"
    >
      <h2 id={titleId} className="text-base font-semibold text-zinc-900">
        {existing ? "Edit team member" : "Add team member"}
      </h2>
      <Field label="Name" htmlFor={`${titleId}-name`}>
        <Input id={`${titleId}-name`} value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={160} placeholder="Ali Raza" />
      </Field>
      <Field label="WhatsApp number" htmlFor={`${titleId}-wa`} hint="Optional. With country code, e.g. +92 300 1234567.">
        <Input id={`${titleId}-wa`} value={number} onChange={(e) => setNumber(e.target.value)} inputMode="tel" maxLength={32} placeholder="+92 300 1234567" />
      </Field>
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2 pt-1">
        {existing ? (
          <Button variant={existing.isActive ? "dangerGhost" : "ghost"} size="sm" onClick={toggleActive} disabled={pending}>
            {existing.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
            {existing ? "Save" : "Add"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** A member's work: every share on their tasks, with mark done / reopen. The body remounts per member. */
function MemberWorkDialog({ member, onClose }: { member: TeamMemberView | null; onClose: () => void }) {
  const titleId = useId();
  return (
    <Modal open={member !== null} onClose={onClose} labelledBy={titleId} className={WIDE_MODAL}>
      {member ? <MemberWork key={member.id} member={member} titleId={titleId} onClose={onClose} /> : null}
    </Modal>
  );
}

function MemberWork({ member, titleId, onClose }: { member: TeamMemberView; titleId: string; onClose: () => void }) {
  const router = useRouter();
  const [shares, setShares] = useState<MemberShareView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => new Date());

  const load = () =>
    start(async () => {
      const result = await getMemberWorkAction({ memberId: member.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShares(result.shares);
      setNow(new Date());
    });

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = (share: MemberShareView, status: "DONE" | "PROCESSING") =>
    start(async () => {
      const result = await setShareStatusAction({ shareId: share.id, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      load();
      router.refresh();
    });

  const processing = shares ? shares.filter((s) => s.status === "PROCESSING").length : member.processing;
  const done = shares ? shares.filter((s) => s.status === "DONE").length : member.done;

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-base font-semibold text-zinc-900">
            {member.name}
          </h2>
          <p className="text-xs text-zinc-500">
            {processing} processing · {done} done
          </p>
        </div>
        <WhatsAppLink number={member.whatsappNumber} label={`WhatsApp ${member.name}`}>
          WhatsApp
        </WhatsAppLink>
      </div>
      <div className="max-h-[60dvh] overflow-y-auto px-5 py-3">
        {error ? <p className="py-6 text-center text-sm text-red-600">{error}</p> : null}
        {!error && shares === null ? <p className="py-6 text-center text-sm text-zinc-500">Loading…</p> : null}
        {shares && shares.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Nothing assigned yet. Use a task&apos;s Team button on Orders.</p>
        ) : null}
        {shares && shares.length > 0 ? (
          <ul className="divide-y divide-zinc-100">
            {shares.map((s) => {
              const unit = unitOf(s);
              return (
                <li key={s.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        Order #{s.orderNumber} · {s.serviceName}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
                        {s.amount !== null ? `${formatCount(s.done)} / ${formatCount(s.amount)}${unit ? ` ${unit}` : ""} · ` : ""}
                        Assigned {when(s.assignedAt)}
                        {s.status === "DONE" && s.finishedAt ? <span className="text-emerald-700"> · Completed {when(s.finishedAt)}</span> : null} · {lowerFirst(shareDuration(s, now))}
                      </p>
                    </div>
                    <ShareStatusPill status={s.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={s.status === "DONE" ? "ghost" : "secondary"}
                      disabled={pending}
                      onClick={() => setStatus(s, s.status === "DONE" ? "PROCESSING" : "DONE")}
                    >
                      {s.status === "DONE" ? "Reopen" : "Mark done"}
                    </Button>
                    <WhatsAppLink number={s.memberWhatsapp} label={`Send ${s.memberName} this task on WhatsApp`} text={shareMessage(s)} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <div className="flex justify-end border-t border-zinc-100 px-5 py-3">
        <Button onClick={onClose}>Close</Button>
      </div>
    </>
  );
}
