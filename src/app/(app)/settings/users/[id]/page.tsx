import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, MetaList, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { getUserAccessDetail, listAssignableRoles } from "@/lib/access/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { PERMISSION_CATALOG } from "@/lib/permissions/catalog";
import { AccessMatrix } from "./access-matrix";
import { ActivationControl } from "./activation-control";
import { RoleEditor } from "./role-editor";

export const metadata: Metadata = { title: "User access" };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function UserDetailPage({ params }: PageProps<"/settings/users/[id]">) {
  const actor = await requirePermission("users.view");
  const { id } = await params;

  const user = await getUserAccessDetail(id);
  if (!user) notFound();

  const canEdit = actor.permissions.has("users.edit");
  const isSelf = actor.user.id === user.id;
  const roles = canEdit ? await listAssignableRoles() : [];

  // The catalog drives the matrix so that a permission which exists in code but
  // has not been seeded yet is still visible (as "not granted") rather than
  // silently absent.
  const catalog = PERMISSION_CATALOG.map((definition) => ({
    key: definition.key,
    name: definition.name,
    module: definition.module,
    description: definition.description,
  }));

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Settings" },
          { label: "Users", href: "/settings/users" },
          { label: user.fullName },
        ]}
      />

      <PageHeader
        title={user.fullName}
        description={user.jobTitle ?? undefined}
        actions={
          canEdit ? (
            <ActivationControl userId={user.id} isActive={user.isActive} disabled={isSelf} />
          ) : undefined
        }
      />

      <Section title="Profile">
        <MetaList
          items={[
            { label: "Email", value: user.email },
            { label: "Phone", value: user.phone ?? <span className="text-ink-faint">—</span> },
            {
              label: "Status",
              value: (
                <StatusDot
                  tone={user.isActive ? "done" : "neutral"}
                  label={user.isActive ? "Active" : "Inactive"}
                />
              ),
            },
            {
              label: "Sign-in",
              value: (
                <StatusDot
                  tone={user.hasSignIn ? "done" : "warning"}
                  label={user.hasSignIn ? "Linked to Supabase Auth" : "No credentials yet"}
                />
              ),
            },
            { label: "Created", value: `${dateFormat.format(user.createdAt)} UTC` },
            {
              label: "Last sign-in",
              value: user.lastLoginAt ? (
                `${dateFormat.format(user.lastLoginAt)} UTC`
              ) : (
                <span className="text-ink-faint">Never</span>
              ),
            },
            { label: "Effective permissions", value: user.grantedCount },
            {
              label: "Direct overrides",
              value:
                user.directAllowCount + user.directDenyCount === 0 ? (
                  <span className="text-ink-faint">None</span>
                ) : (
                  `${user.directAllowCount} allow · ${user.directDenyCount} deny`
                ),
            },
          ]}
        />
      </Section>

      {!user.isActive ? (
        <div className="mb-10 border-l-2 border-zinc-400 pl-4">
          <p className="text-[13px] font-medium text-ink">This account is deactivated</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Role assignments are preserved but resolve to no access. Everything below shows what
            this user would have if reactivated.
          </p>
        </div>
      ) : null}

      <Section
        title="Roles"
        description="A user may hold several roles. Effective role permissions are the union of all of them."
      >
        <RoleEditor
          userId={user.id}
          assigned={user.roles}
          available={roles}
          canEdit={canEdit}
          isSelf={isSelf}
        />
      </Section>

      <Section
        title="Effective access"
        description="Resolution order: direct deny, then direct allow, then any role grant, otherwise no access."
      >
        <AccessMatrix
          userId={user.id}
          catalog={catalog}
          decisions={user.decisions}
          canEdit={canEdit}
          isSelf={isSelf}
          isActive={user.isActive}
        />
      </Section>
    </>
  );
}
