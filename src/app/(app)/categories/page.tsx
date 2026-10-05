import type { Metadata } from "next";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { listCategories } from "@/lib/categories/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { CategoryCreateControl } from "./category-create-control";
import { CategoryList } from "./category-list";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const actor = await requirePermission("categories.view");
  const categories = await listCategories();
  const canManage = actor.permissions.has("categories.edit");
  const canCreate = actor.permissions.has("categories.create");
  const canDelete = actor.permissions.has("categories.delete");

  return (
    <>
      <Breadcrumbs items={[{ label: "Services" }, { label: "Categories" }]} />
      <PageHeader
        title="Categories"
        description="Group related services (specification Section 50), e.g. Design containing UX Design, UI Design, Wireframes."
        actions={canCreate ? <CategoryCreateControl /> : undefined}
      />

      <Section>
        <CategoryList categories={categories} canEdit={canManage} canDelete={canDelete} />
      </Section>
    </>
  );
}
