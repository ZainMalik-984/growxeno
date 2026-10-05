"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { assignRoleAction, removeRoleAction } from "@/lib/access/actions";

/**
 * Assign and remove roles.
 *
 * The control is hidden without users.edit and disabled when viewing your own
 * profile, but neither of those is the protection: the Server Action re-checks
 * the permission and independently refuses self-modification.
 */
export function RoleEditor({
  userId,
  assigned,
  available,
  canEdit,
  isSelf,
}: {
  userId: string;
  assigned: ReadonlyArray<{ id: string; name: string }>;
  available: ReadonlyArray<{ id: string; name: string }>;
  canEdit: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");

  const assignedIds = new Set(assigned.map((role) => role.id));
  const assignable = available.filter((role) => !assignedIds.has(role.id));

  const run = (action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {assigned.length === 0 ? (
        <p className="text-[13px] text-ink-faint">
          No roles assigned. This user has no access beyond any direct allow overrides.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {assigned.map((role) => (
            <li
              key={role.id}
              className="inline-flex items-center gap-1.5 border border-line px-2 py-1 text-[13px] text-ink"
            >
              {role.name}
              {canEdit && !isSelf ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeRoleAction({ userId, roleId: role.id }))}
                  aria-label={`Remove role ${role.name}`}
                  className="text-ink-faint transition-colors hover:text-red-600 disabled:opacity-40"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        isSelf ? (
          <p className="text-xs text-ink-faint">
            You cannot change your own roles. Another administrator must do it.
          </p>
        ) : assignable.length > 0 ? (
          <div className="flex items-center gap-2">
            <label htmlFor="role-select" className="sr-only">
              Role to assign
            </label>
            <select
              id="role-select"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="h-8 rounded-[3px] border border-line bg-canvas px-2 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
            >
              <option value="">Select a role…</option>
              {assignable.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="md"
              disabled={!selected || pending}
              onClick={() => {
                const roleId = selected;
                setSelected("");
                run(() => assignRoleAction({ userId, roleId }));
              }}
            >
              Assign role
            </Button>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">Every role is already assigned.</p>
        )
      ) : null}
    </div>
  );
}
