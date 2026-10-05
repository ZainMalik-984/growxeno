"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { setRolePermissionAction } from "@/lib/access/actions";
import { cn } from "@/lib/utils";

/**
 * Role permission editor.
 *
 * A flat checkbox grid grouped by module. Each toggle is one authorized,
 * audited Server Action rather than a bulk "save everything" submit, so the
 * audit trail records exactly which permission changed and when.
 *
 * The checkbox state is optimistic so the grid feels immediate, and reverts if
 * the server rejects the change.
 */

type ModuleGroup = {
  module: string;
  permissions: Array<{ key: string; name: string; description: string }>;
};

export function RolePermissionEditor({
  roleId,
  modules,
  grantedKeys,
  canEdit,
}: {
  roleId: string;
  modules: readonly ModuleGroup[];
  grantedKeys: readonly string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const [granted, setGranted] = useOptimistic(
    new Set(grantedKeys),
    (current: Set<string>, change: { key: string; granted: boolean }) => {
      const next = new Set(current);
      if (change.granted) next.add(change.key);
      else next.delete(change.key);
      return next;
    },
  );

  const toggle = (key: string, next: boolean) => {
    startTransition(async () => {
      setGranted({ key, granted: next });
      const result = await setRolePermissionAction({ roleId, permissionKey: key, granted: next });
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error);
        // Discarding the optimistic value: refresh pulls the true state back.
        router.refresh();
      }
    });
  };

  const search = query.trim().toLowerCase();
  const visibleModules = modules
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter(
        (permission) =>
          !search ||
          permission.key.toLowerCase().includes(search) ||
          permission.name.toLowerCase().includes(search),
      ),
    }))
    .filter((group) => group.permissions.length > 0);

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <label htmlFor="role-permission-filter" className="sr-only">
          Filter permissions
        </label>
        <input
          id="role-permission-filter"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter permissions…"
          className="h-8 w-full max-w-sm rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink placeholder:text-ink-faint hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
        />
        <span className="whitespace-nowrap text-xs text-ink-faint">
          {granted.size} granted
        </span>
      </div>

      {visibleModules.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">
          No permissions match that filter.
        </p>
      ) : (
        <div className="space-y-7">
          {visibleModules.map((group) => (
            <fieldset key={group.module}>
              <legend className="section-title mb-2">{group.module.replace(/_/g, " ")}</legend>
              <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {group.permissions.map((permission) => {
                  const checked = granted.has(permission.key);
                  const inputId = `perm-${permission.key.replace(/\./g, "-")}`;

                  return (
                    <div key={permission.key} className="flex items-start gap-2">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={checked}
                        disabled={!canEdit || pending}
                        onChange={(event) => toggle(permission.key, event.target.checked)}
                        aria-describedby={`${inputId}-desc`}
                        className="mt-0.5 size-3.5 shrink-0 accent-zinc-900 disabled:opacity-40"
                      />
                      <label
                        htmlFor={inputId}
                        className={cn(
                          "min-w-0 cursor-pointer text-[13px]",
                          !canEdit && "cursor-default",
                          checked ? "text-ink" : "text-ink-muted",
                        )}
                      >
                        <span className="block font-mono text-xs">{permission.key}</span>
                        <span id={`${inputId}-desc`} className="block text-xs text-ink-faint">
                          {permission.name}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
