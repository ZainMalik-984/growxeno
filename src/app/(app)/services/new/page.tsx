import type { Metadata } from "next";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { listAssignableCategories } from "@/lib/categories/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { CreateServiceForm } from "./create-service-form";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage() {
  await requirePermission("services.create");
  const categories = await listAssignableCategories();

  return (
    <>
      <Breadcrumbs
        items={[{ label: "Services" }, { label: "Services", href: "/services" }, { label: "New" }]}
      />
      <PageHeader
        title="New service"
        description={
          categories.length === 0
            ? "Create a category first — every service belongs to one."
            : "The base price is a reference figure — an order's price is entered on the order itself."
        }
      />

      <Section>
        <CreateServiceForm categories={categories} />
      </Section>
    </>
  );
}
