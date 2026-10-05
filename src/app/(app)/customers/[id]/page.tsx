import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, MetaList, PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { getCustomerDetail } from "@/lib/customers/queries";
import { CustomerDeleteControl } from "./customer-delete-control";
import { CustomerProfileForm } from "./customer-profile-form";

export const metadata: Metadata = { title: "Customer" };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function CustomerDetailPage({ params }: PageProps<"/customers/[id]">) {
  const actor = await requirePermission("customers.view");
  const { id } = await params;

  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  const canEdit = actor.permissions.has("customers.edit");
  const canDelete = actor.permissions.has("customers.delete");

  return (
    <>
      <Breadcrumbs
        items={[{ label: "CRM" }, { label: "Customers", href: "/customers" }, { label: customer.name }]}
      />

      <PageHeader
        title={customer.name}
        description={customer.type === "COMPANY" ? "Company" : "Individual"}
        actions={canDelete ? <CustomerDeleteControl customerId={customer.id} name={customer.name} /> : undefined}
      />

      <Section title="Profile">
        <CustomerProfileForm customer={customer} canEdit={canEdit} />
      </Section>

      <Section title="Orders">
        <p className="text-[13px] text-ink-faint">Not available yet — Orders are Phase 4.</p>
      </Section>

      <Section title="Details">
        <MetaList
          items={[
            { label: "Created", value: `${dateFormat.format(customer.createdAt)} UTC` },
            { label: "Updated", value: `${dateFormat.format(customer.updatedAt)} UTC` },
          ]}
        />
      </Section>
    </>
  );
}
