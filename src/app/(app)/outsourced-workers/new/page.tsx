import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/authorize";

/**
 * Adding a worker is a popup on the Outsourced Workers list now (2026-11-18).
 * Old links and bookmarks to this page open that popup.
 */
export default async function NewOutsourcedWorkerPage() {
  await requirePermission("outsourced_workers.create");
  redirect("/outsourced-workers?new=1");
}
