import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs, MetaList, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { getRoleDetail } from "@/lib/access/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { permissionsByModule } from "@/lib/permissions/catalog";
import { RoleActions } from "./role-actions";
import { RolePermissionEditor } from "./role-permission-editor";

export const metadata: Metadata = { title: "Role" };

export default async function RoleDetailPage({ params }: PageProps<"/settings/roles/[id]">) {
  const actor = await requirePermission("roles.view");
  const { id } = await params;

  const role = await getRoleDetail(id);
  if (!role) notFound();

  const canEdit = actor.permissions.has("roles.edit");
  const canCreate = actor.permissions.has("roles.create");
  const canDelete = actor.permissions.has("roles.delete");
  const modules = permissionsByModule();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Settings" },
          { label: "Roles", href: "/settings/roles" },
          { label: role.name },
        ]}
      />

      <PageHeader
        title={role.name}
        description={role.description ?? undefined}
        actions={
          canEdit || canCreate || canDelete ? (
            <RoleActions
              roleId={role.id}
              name={role.name}
              description={role.description}
              isSystem={role.isSystem}
              userCount={role.users.length}
              canEdit={canEdit}
              canCreate={canCreate}
              canDelete={canDelete}
            />
          ) : undefined
        }
      />

      <Section title="Details">
        <MetaList
          items={[
            { label: "Slug", value: <span className="font-mono text-xs">{role.slug}</span> },
            {
              label: "Type",
              value: (
                <StatusDot
                  tone={role.isSystem ? "active" : "neutral"}
                  label={role.isSystem ? "System role" : "Custom role"}
                />
              ),
            },
            { label: "Permissions", value: role.permissionKeys.size },
            { label: "Users", value: role.users.length },
          ]}
        />
      </Section>

      <Section
        title="Permissions"
        description={
          canEdit
            ? "Changes apply immediately to everyone holding this role, unless a direct deny overrides it."
            : "You have read-only access to this role. Editing requires roles.edit."
        }
      >
        <RolePermissionEditor
          roleId={role.id}
          modules={modules.map((group) => ({
            module: group.module,
            permissions: group.permissions.map((permission) => ({
              key: permission.key,
              name: permission.name,
              description: permission.description,
            })),
          }))}
          grantedKeys={[...role.permissionKeys]}
          canEdit={canEdit}
        />
      </Section>

      <Section title="Users with this role">
        {role.users.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No users hold this role.</p>
        ) : (
          <ul className="space-y-1">
            {role.users.map((user) => (
              <li key={user.id} className="text-[13px]">
                <Link href={`/settings/users/${user.id}`} className="text-ink hover:underline">
                  {user.fullName}
                </Link>
                <span className="text-ink-faint"> · {user.email}</span>
                {!user.isActive ? <span className="text-ink-faint"> · inactive</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
