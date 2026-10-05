"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { clearDirectPermissionAction, setDirectPermissionAction } from "@/lib/access/actions";
import type { PermissionDecision, PermissionSource } from "@/lib/permissions/resolve";
import { cn } from "@/lib/utils";

/**
 * The effective access view (specification Section 12).
 *
 * For every permission it shows the final decision, where that decision came
 * from, and — with users.edit — lets an administrator apply or clear a direct
 * ALLOW/DENY override. This is the screen someone opens when they are trying to
 * work out why a colleague can or cannot do something, so the SOURCE column
 * matters as much as the outcome.
 */

type CatalogEntry = {
  key: string;
  name: string;
  module: string;
  description: string;
};

const SOURCE_LABEL: Record<PermissionSource, string> = {
  DIRECT_DENY: "Direct deny",
  DIRECT_ALLOW: "Direct allow",
  ROLE: "Role",
  NONE: "Not granted",
  INACTIVE: "Account inactive",
};

const SOURCE_TONE: Record<PermissionSource, StatusTone> = {
  DIRECT_DENY: "danger",
  DIRECT_ALLOW: "active",
  ROLE: "done",
  NONE: "neutral",
  INACTIVE: "neutral",
};

type Filter = "all" | "granted" | "overrides";

export function AccessMatrix({
  userId,
  catalog,
  decisions,
  canEdit,
  isSelf,
  isActive,
}: {
  userId: string;
  catalog: readonly CatalogEntry[];
  decisions: readonly PermissionDecision[];
  canEdit: boolean;
  isSelf: boolean;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const decisionByKey = useMemo(
    () => new Map(decisions.map((decision) => [decision.key, decision])),
    [decisions],
  );

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();

    return catalog
      .map((entry) => ({
        entry,
        decision:
          decisionByKey.get(entry.key) ??
          ({ key: entry.key, granted: false, source: "NONE", viaRoles: [] } satisfies PermissionDecision),
      }))
      .filter(({ entry, decision }) => {
        if (filter === "granted" && !decision.granted) return false;
        if (
          filter === "overrides" &&
          decision.source !== "DIRECT_ALLOW" &&
          decision.source !== "DIRECT_DENY"
        ) {
          return false;
        }
        if (!search) return true;
        return (
          entry.key.toLowerCase().includes(search) || entry.name.toLowerCase().includes(search)
        );
      });
  }, [catalog, decisionByKey, filter, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const existing = groups.get(row.entry.module);
      if (existing) existing.push(row);
      else groups.set(row.entry.module, [row]);
    }
    return [...groups.entries()];
  }, [rows]);

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

  const editable = canEdit && !isSelf;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1" role="group" aria-label="Filter permissions">
          {(
            [
              ["all", "All"],
              ["granted", "Granted"],
              ["overrides", "Overrides"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "rounded-[3px] px-2 py-1 text-[13px] transition-colors",
                filter === value
                  ? "bg-zinc-200/60 font-medium text-ink-strong"
                  : "text-ink-muted hover:bg-canvas-subtle hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-w-56 flex-1">
          <label htmlFor="permission-filter" className="sr-only">
            Filter permissions by name or key
          </label>
          <input
            id="permission-filter"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter permissions…"
            className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink placeholder:text-ink-faint hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
          />
        </div>

        {isSelf && canEdit ? (
          <p className="text-xs text-ink-faint">You cannot change your own permissions.</p>
        ) : null}
      </div>

      {!isActive ? (
        <p className="mb-3 text-xs text-ink-faint">
          Account inactive: every permission resolves to no access regardless of the sources below.
        </p>
      ) : null}

      {grouped.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">
          No permissions match this filter.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([module, moduleRows]) => (
            <div key={module}>
              <h3 className="section-title mb-2">{module.replace(/_/g, " ")}</h3>
              <TableWrap>
                <Table>
                  <caption className="sr-only">{module} permissions</caption>
                  <THead>
                    <TR>
                      <TH className="w-[34%]">Permission</TH>
                      <TH className="w-[14%]">Effective</TH>
                      <TH className="w-[26%]">Source</TH>
                      {editable ? <TH className="w-[26%] text-right">Override</TH> : null}
                    </TR>
                  </THead>
                  <TBody>
                    {moduleRows.map(({ entry, decision }) => {
                      const hasOverride =
                        decision.source === "DIRECT_ALLOW" || decision.source === "DIRECT_DENY";

                      return (
                        <TR key={entry.key}>
                          <TD>
                            <span className="font-mono text-xs text-ink">{entry.key}</span>
                            <span className="block text-xs text-ink-faint">{entry.name}</span>
                          </TD>
                          <TD>
                            <StatusDot
                              tone={decision.granted ? "done" : "neutral"}
                              label={decision.granted ? "Allowed" : "Denied"}
                            />
                          </TD>
                          <TD>
                            <StatusDot
                              tone={SOURCE_TONE[decision.source]}
                              label={SOURCE_LABEL[decision.source]}
                            />
                            {decision.viaRoles.length > 0 ? (
                              <span className="block text-xs text-ink-faint">
                                via {decision.viaRoles.join(", ")}
                              </span>
                            ) : null}
                          </TD>
                          {editable ? (
                            <TD className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <OverrideButton
                                  label="Allow"
                                  active={decision.source === "DIRECT_ALLOW"}
                                  disabled={pending}
                                  onClick={() =>
                                    run(() =>
                                      setDirectPermissionAction({
                                        userId,
                                        permissionKey: entry.key,
                                        effect: "ALLOW",
                                      }),
                                    )
                                  }
                                />
                                <OverrideButton
                                  label="Deny"
                                  tone="danger"
                                  active={decision.source === "DIRECT_DENY"}
                                  disabled={pending}
                                  onClick={() =>
                                    run(() =>
                                      setDirectPermissionAction({
                                        userId,
                                        permissionKey: entry.key,
                                        effect: "DENY",
                                      }),
                                    )
                                  }
                                />
                                <OverrideButton
                                  label="Clear"
                                  active={false}
                                  disabled={pending || !hasOverride}
                                  onClick={() =>
                                    run(() =>
                                      clearDirectPermissionAction({
                                        userId,
                                        permissionKey: entry.key,
                                      }),
                                    )
                                  }
                                />
                              </div>
                            </TD>
                          ) : null}
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </TableWrap>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverrideButton({
  label,
  active,
  disabled,
  onClick,
  tone = "default",
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "rounded-[3px] border px-1.5 py-0.5 text-xs transition-colors disabled:opacity-30",
        active
          ? tone === "danger"
            ? "border-red-300 bg-red-50 font-medium text-red-700"
            : "border-zinc-400 bg-zinc-100 font-medium text-ink-strong"
          : "border-transparent text-ink-muted hover:border-line hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
