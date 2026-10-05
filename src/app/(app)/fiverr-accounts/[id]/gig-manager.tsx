"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/status-dot";
import { createGigAction, setGigActiveAction, updateGigAction } from "@/lib/fiverr-accounts/actions";

export type ManagedGig = { id: string; name: string; isActive: boolean };

/** Add/rename/deactivate a Fiverr account's gigs. Daily stats and charts live on the shared Gigs page. */
export function GigManager({ accountId, gigs, canManage }: { accountId: string; gigs: ManagedGig[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const add = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createGigAction({ accountId, name: newName });
      if (result.ok) {
        toast.success(result.message);
        setNewName("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const rename = (gigId: string) => {
    startTransition(async () => {
      const result = await updateGigAction({ gigId, name: editName });
      if (result.ok) {
        toast.success(result.message);
        setEditing(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const toggleActive = (gigId: string, isActive: boolean) => {
    startTransition(async () => {
      const result = await setGigActiveAction({ gigId, isActive: !isActive });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div>
      {gigs.length === 0 ? (
        <p className="text-[13px] text-ink-faint">No gigs yet.</p>
      ) : (
        <ul className="space-y-2">
          {gigs.map((gig) => (
            <li key={gig.id} className="flex items-center justify-between gap-3 text-[13px]">
              {editing === gig.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input value={editName} onChange={(event) => setEditName(event.target.value)} className="h-7 max-w-xs" />
                  <Button variant="ghost" size="sm" onClick={() => rename(gig.id)} disabled={pending || !editName.trim()}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={pending}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <Link href={`/fiverr-accounts/gigs?gig=${gig.id}`} className="text-ink hover:underline">
                    {gig.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <StatusDot tone={gig.isActive ? "done" : "neutral"} label={gig.isActive ? "Active" : "Inactive"} />
                    {canManage ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(gig.id);
                            setEditName(gig.name);
                          }}
                        >
                          Rename
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(gig.id, gig.isActive)} disabled={pending}>
                          {gig.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <Field label="New gig" htmlFor="new-gig-name">
              <Input id="new-gig-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. YouTube Subscribers" />
            </Field>
          </div>
          <Button variant="secondary" onClick={add} disabled={pending || !newName.trim()}>
            Add gig
          </Button>
        </div>
      ) : null}
    </div>
  );
}
