import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { getFiverrAccountDetail } from "@/lib/fiverr-accounts/queries";
import { FiverrAccountForm } from "../fiverr-account-form";
import { FiverrAccountActivationControl } from "./fiverr-account-activation-control";
import { GigManager } from "./gig-manager";

export const metadata: Metadata = { title: "Fiverr account" };

export default async function FiverrAccountDetailPage({ params }: PageProps<"/fiverr-accounts/[id]">) {
  const actor = await requirePermission("fiverr_accounts.view");
  const { id } = await params;

  const account = await getFiverrAccountDetail(id);
  if (!account) notFound();

  const canManage = actor.permissions.has("fiverr_accounts.manage");
  const canRevealCredentials = actor.permissions.has("fiverr_accounts.credentials.view");

  return (
    <>
      <Breadcrumbs items={[{ label: "Fiverr" }, { label: "Accounts", href: "/fiverr-accounts" }, { label: account.name }]} />
      <PageHeader
        title={account.name}
        actions={canManage ? <FiverrAccountActivationControl accountId={account.id} isActive={account.isActive} /> : undefined}
      />

      {!account.isActive ? (
        <div className="mb-10 border-l-2 border-zinc-400 pl-4">
          <p className="text-[13px] font-medium text-ink">This account is deactivated</p>
          <p className="mt-1 text-[13px] text-ink-muted">It no longer appears in the order form&apos;s Fiverr account picker.</p>
        </div>
      ) : null}

      <Section title="Account">
        {canManage ? (
          <FiverrAccountForm
            mode="edit"
            accountId={account.id}
            initial={{ name: account.name, email: account.email, paypalEmail: account.paypalEmail, hasPaypalPassword: account.hasPaypalPassword }}
            canRevealCredentials={canRevealCredentials}
          />
        ) : (
          <dl className="grid max-w-lg grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-ink-faint">Email</dt>
            <dd className="text-ink">{account.email ?? "—"}</dd>
            <dt className="text-ink-faint">PayPal email</dt>
            <dd className="text-ink">{account.paypalEmail ?? "—"}</dd>
          </dl>
        )}
      </Section>

      <Section title="Gigs" description="Daily impressions/clicks and per-gig charts are on the Gigs page.">
        <GigManager accountId={account.id} gigs={account.gigs} canManage={canManage} />
      </Section>
    </>
  );
}
