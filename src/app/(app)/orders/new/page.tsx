import type { Metadata } from "next";

import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { listAssignableFiverrAccounts } from "@/lib/fiverr-accounts/queries";
import { listServicesForOrderPicker } from "@/lib/services/queries";
import { listAssignableOutsourcedWorkers } from "@/lib/outsourced-workers/queries";
import { getWorkloads } from "@/lib/outsourced-workers/workload-queries";
import { EMPTY_WORKLOAD } from "@/lib/outsourced-workers/workload";
import { CreateOrderForm } from "./create-order-form";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const actor = await requirePermission("orders.create");
  // Workers can be assigned while creating (2026-11-12), for people who may assign.
  const canAssign = actor.permissions.has("orders.assign");
  const [fiverrAccounts, services, workerRows, workloads] = await Promise.all([
    listAssignableFiverrAccounts(),
    listServicesForOrderPicker(),
    canAssign ? listAssignableOutsourcedWorkers() : Promise.resolve([]),
    canAssign ? getWorkloads() : Promise.resolve(new Map()),
  ]);
  const workers = canAssign ? workerRows.map((worker) => ({ ...worker, workload: workloads.get(worker.id) ?? EMPTY_WORKLOAD })) : undefined;

  return (
    <>
      <Breadcrumbs items={[{ label: "Operations" }, { label: "Orders", href: "/orders" }, { label: "New order" }]} />
      <PageHeader
        title="New order"
        description="Create an order, add its services, and assign workers."
      />

      <CreateOrderForm
        fiverrAccounts={fiverrAccounts}
        services={services}
        canCreateCustomer={actor.permissions.has("customers.create")}
        workers={workers}
      />
    </>
  );
}
