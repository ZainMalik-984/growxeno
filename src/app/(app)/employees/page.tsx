import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listRoles } from "@/lib/access/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { listEmployees } from "@/lib/employees/queries";
import { AddEmployeeButton } from "./add-employee-dialog";

export const metadata: Metadata = { title: "Employees" };

/**
 * The internal employee roster (specification Sections 43–45) — active
 * `User`s in their Employee capacity. Renamed from "Worker" (owner-directed,
 * confirmed directly, 2026-10-08) — Employees manage orders and assignments;
 * they are not themselves assigned Order Items (see
 * `src/lib/outsourced-workers/` for who actually performs the work). Gated
 * by `employees.view.all`: a plain `employees.view` shows an employee only
 * their own profile at `/employees/[id]`, never this list.
 */
export default async function EmployeesPage() {
  const actor = await requirePermission("employees.view.all");
  const canCreate = actor.permissions.has("users.create");
  const [employees, roles] = await Promise.all([listEmployees(), canCreate ? listRoles() : Promise.resolve([])]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Workforce" }, { label: "Employees" }]} />
      <PageHeader
        title="Employees"
        description="Internal users who manage orders and assignments."
        actions={canCreate ? <AddEmployeeButton roles={roles} /> : undefined}
      />

      <Section>
        {employees.length === 0 ? (
          <EmptyState title="No employees yet" description="Invite a user to have them appear here." />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Employees</caption>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Roles</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Open orders</TH>
                </TR>
              </THead>
              <TBody>
                {employees.map((employee) => (
                  <TR key={employee.id}>
                    <TD>
                      <Link href={`/employees/${employee.id}`} className="font-medium text-ink hover:underline">
                        {employee.fullName}
                      </Link>
                    </TD>
                    <TD className="text-ink-muted">{employee.email}</TD>
                    <TD className="text-ink-muted">
                      {employee.roleNames.length > 0 ? employee.roleNames.join(", ") : <span className="text-ink-faint">None</span>}
                    </TD>
                    <TD>
                      {employee.invitePending ? (
                        <StatusDot tone="warning" label="Invite pending" />
                      ) : (
                        <StatusDot tone="done" label="Active" />
                      )}
                    </TD>
                    <TD className="text-right text-ink-muted">{employee.openOrderCount}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
