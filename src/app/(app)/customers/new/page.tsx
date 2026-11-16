import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/authorize";

/** New customer is a popup on the Customers page now (2026-11-16); old links open it there. */
export default async function NewCustomerPage() {
  await requirePermission("customers.create");
  redirect("/customers?new=1");
}
