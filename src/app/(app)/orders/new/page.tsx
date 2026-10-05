import type { Metadata } from "next";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { listAssignableFiverrAccounts } from "@/lib/fiverr-accounts/queries";
import { CreateOrderForm } from "./create-order-form";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const actor = await requirePermission("orders.create");
  const fiverrAccounts = await listAssignableFiverrAccounts();

  return (
    <>
      <Breadcrumbs items={[{ label: "Operations" }, { label: "Orders", href: "/orders" }, { label: "New" }]} />
      <PageHeader
        title="New order"
        description="Add items after creating the order. A Fiverr-sourced order takes which of your Fiverr accounts it came in on; an External order does not."
      />

      <Section>
        <CreateOrderForm fiverrAccounts={fiverrAccounts} canCreateCustomer={actor.permissions.has("customers.create")} />
      </Section>
    </>
  );
}
