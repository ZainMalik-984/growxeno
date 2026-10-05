import type { Metadata } from "next";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { FiverrAccountForm } from "../fiverr-account-form";

export const metadata: Metadata = { title: "New Fiverr account" };

export default async function NewFiverrAccountPage() {
  await requirePermission("fiverr_accounts.manage");

  return (
    <>
      <Breadcrumbs items={[{ label: "Fiverr" }, { label: "Accounts", href: "/fiverr-accounts" }, { label: "New" }]} />
      <PageHeader title="New Fiverr account" description="The PayPal password, if given, is encrypted before it is stored." />

      <Section>
        <FiverrAccountForm mode="create" />
      </Section>
    </>
  );
}
