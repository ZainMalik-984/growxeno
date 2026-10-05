import type { Metadata } from "next";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { CreateCustomerForm } from "./create-customer-form";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  await requirePermission("customers.create");

  return (
    <>
      <Breadcrumbs
        items={[{ label: "CRM" }, { label: "Customers", href: "/customers" }, { label: "New" }]}
      />
      <PageHeader title="New customer" description="Name required, everything else optional." />

      <Section>
        <CreateCustomerForm />
      </Section>
    </>
  );
}
