import type { Metadata } from "next";

import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { listAssignableFiverrAccounts } from "@/lib/fiverr-accounts/queries";
import { listServicesForOrderPicker } from "@/lib/services/queries";
import { CreateOrderForm } from "./create-order-form";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const actor = await requirePermission("orders.create");
  const [fiverrAccounts, services] = await Promise.all([listAssignableFiverrAccounts(), listServicesForOrderPicker()]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Operations" }, { label: "Orders", href: "/orders" }, { label: "New order" }]} />
      <PageHeader
        title="New order"
        description="Create an order, link a customer, and optionally add the first service."
      />

      <CreateOrderForm fiverrAccounts={fiverrAccounts} services={services} canCreateCustomer={actor.permissions.has("customers.create")} />
    </>
  );
}
