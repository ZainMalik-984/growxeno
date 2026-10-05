import type { Metadata } from "next";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { CreateOutsourcedWorkerForm } from "./create-outsourced-worker-form";

export const metadata: Metadata = { title: "New outsourced worker" };

export default async function NewOutsourcedWorkerPage() {
  await requirePermission("workers.create");

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Workforce" },
          { label: "Outsourced Workers", href: "/outsourced-workers" },
          { label: "New" },
        ]}
      />
      <PageHeader title="New outsourced worker" description="No application account is created — this is a cost-tracking contact only." />

      <Section>
        <CreateOutsourcedWorkerForm />
      </Section>
    </>
  );
}
