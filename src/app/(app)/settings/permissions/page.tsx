import type { Metadata } from "next";

import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listStoredPermissions } from "@/lib/access/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { PERMISSION_CATALOG } from "@/lib/permissions/catalog";

export const metadata: Metadata = { title: "Permissions" };

/**
 * The permission catalog.
 *
 * Read-only by design: permissions are defined in code
 * (src/lib/permissions/catalog.ts) and synced to the database by the seed. That
 * keeps every `can("orders.view")` call type-checked against a real key, which
 * an editable-in-the-UI catalog could not guarantee.
 *
 * This page also surfaces DRIFT — keys that exist in code but have not been
 * seeded — because a silently missing permission is a confusing way to lose
 * access.
 */
export default async function PermissionsPage() {
  await requirePermission("permissions.view");

  const stored = await listStoredPermissions();
  const storedKeys = new Set(stored.map((permission) => permission.key));
  const missingFromDatabase = PERMISSION_CATALOG.filter(
    (definition) => !storedKeys.has(definition.key),
  );

  const grouped = stored.reduce<Map<string, typeof stored>>((accumulator, permission) => {
    const existing = accumulator.get(permission.module);
    if (existing) existing.push(permission);
    else accumulator.set(permission.module, [permission]);
    return accumulator;
  }, new Map());

  return (
    <>
      <Breadcrumbs items={[{ label: "Settings" }, { label: "Permissions" }]} />
      <PageHeader
        title="Permissions"
        description={`${PERMISSION_CATALOG.length} permissions defined in code, ${stored.length} present in the database.`}
      />

      {missingFromDatabase.length > 0 ? (
        <div className="mb-8 border-l-2 border-amber-500 pl-4">
          <p className="text-[13px] font-medium text-ink">
            {missingFromDatabase.length} permission
            {missingFromDatabase.length === 1 ? " is" : "s are"} defined in code but not seeded
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Run <code className="font-mono text-xs">pnpm db:seed</code> to sync the catalog. Until
            then these cannot be granted to a role.
          </p>
          <ul className="mt-2 font-mono text-xs text-ink-muted">
            {missingFromDatabase.slice(0, 10).map((definition) => (
              <li key={definition.key}>{definition.key}</li>
            ))}
            {missingFromDatabase.length > 10 ? (
              <li className="text-ink-faint">…and {missingFromDatabase.length - 10} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <Section>
        {stored.length === 0 ? (
          <EmptyState
            title="The catalog has not been seeded"
            description="Run pnpm db:seed to load the permission catalog and the starting roles."
          />
        ) : (
          <div className="space-y-8">
            {[...grouped.entries()].map(([module, permissions]) => (
              <div key={module}>
                <h2 className="section-title mb-2">{module.replace(/_/g, " ")}</h2>
                <TableWrap>
                  <Table>
                    <caption className="sr-only">{module} permissions</caption>
                    <THead>
                      <TR>
                        <TH className="w-[26%]">Key</TH>
                        <TH className="w-[22%]">Name</TH>
                        <TH>Description</TH>
                        <TH className="w-[10%] text-right">Roles</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {permissions.map((permission) => (
                        <TR key={permission.id}>
                          <TD className="font-mono text-xs">{permission.key}</TD>
                          <TD className="text-ink">{permission.name}</TD>
                          <TD className="text-ink-muted">{permission.description ?? "—"}</TD>
                          <TD className="text-right">
                            {permission.roleCount > 0 ? (
                              <span className="text-ink-muted">{permission.roleCount}</span>
                            ) : (
                              <StatusDot tone="neutral" label="Unused" />
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
