import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listRoles } from "@/lib/access/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { PERMISSION_CATALOG } from "@/lib/permissions/catalog";
import { RoleCreateControl } from "./role-create-control";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const actor = await requirePermission("roles.view");
  const roles = await listRoles();
  const catalogSize = PERMISSION_CATALOG.length;

  return (
    <>
      <Breadcrumbs items={[{ label: "Settings" }, { label: "Roles" }]} />
      <PageHeader
        title="Roles"
        description="Roles are editable collections of permissions. Seeded roles behave like any other role — nothing about them is hard-coded."
        actions={actor.permissions.has("roles.create") ? <RoleCreateControl /> : undefined}
      />

      <Section>
        {roles.length === 0 ? (
          <EmptyState
            title="No roles yet"
            description="Run pnpm db:seed to create the starting roles and the permission catalog."
          />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Roles</caption>
              <THead>
                <TR>
                  <TH>Role</TH>
                  <TH>Description</TH>
                  <TH className="text-right">Permissions</TH>
                  <TH className="text-right">Users</TH>
                  <TH>Type</TH>
                </TR>
              </THead>
              <TBody>
                {roles.map((role) => (
                  <TR key={role.id}>
                    <TD>
                      <Link
                        href={`/settings/roles/${role.id}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {role.name}
                      </Link>
                      <span className="block font-mono text-xs text-ink-faint">{role.slug}</span>
                    </TD>
                    <TD className="max-w-md text-ink-muted">
                      {role.description ?? <span className="text-ink-faint">—</span>}
                    </TD>
                    <TD className="text-right text-ink-muted">
                      {role.permissionCount} / {catalogSize}
                    </TD>
                    <TD className="text-right text-ink-muted">{role.userCount}</TD>
                    <TD>
                      <StatusDot
                        tone={role.isSystem ? "active" : "neutral"}
                        label={role.isSystem ? "System" : "Custom"}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Section>

      <Section title="About system roles">
        <p className="max-w-2xl text-[13px] text-ink-muted">
          A system role is protected from deletion so the application cannot be left without an
          administrator. Its permissions remain fully editable — the authorization system never
          branches on a role&apos;s name.
        </p>
      </Section>
    </>
  );
}
