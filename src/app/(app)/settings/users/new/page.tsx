import type { Metadata } from "next";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { listAssignableRoles } from "@/lib/access/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { CreateUserForm } from "./create-user-form";

export const metadata: Metadata = { title: "New user" };

export default async function NewUserPage() {
  await requirePermission("users.create");
  const roles = await listAssignableRoles();

  return (
    <>
      <Breadcrumbs
        items={[{ label: "Settings" }, { label: "Users", href: "/settings/users" }, { label: "New" }]}
      />
      <PageHeader
        title="Invite a user"
        description="Creates the application profile and emails an invitation to set a password. They cannot sign in until they accept it."
      />

      <Section>
        <CreateUserForm roles={roles} />
      </Section>
    </>
  );
}
