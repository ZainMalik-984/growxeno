import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { getFiverrAccountDetail } from "@/lib/fiverr-accounts/queries";
import { FiverrAccountForm } from "../fiverr-account-form";
import { FiverrAccountActivationControl } from "./fiverr-account-activation-control";
import { GigManager } from "./gig-manager";
import { GmailMonitoringSection } from "./gmail-monitoring-section";
import { isUuid } from "@/lib/validation/url-params";

export const metadata: Metadata = { title: "Fiverr account" };

export default async function FiverrAccountDetailPage({ params }: PageProps<"/fiverr-accounts/[id]">) {
  const actor = await requirePermission("fiverr_accounts.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const account = await getFiverrAccountDetail(id);
  if (!account) notFound();

  const canManage = actor.permissions.has("fiverr_accounts.manage");
  const canRevealCredentials = actor.permissions.has("fiverr_accounts.credentials.view");

  return (
    <>
      <Breadcrumbs items={[{ label: "Fiverr" }, { label: "Accounts", href: "/fiverr-accounts" }, { label: account.name }]} />
      <PageHeader
        title={account.name}
        description={!account.isActive ? "This account is deactivated and no longer appears in the order form." : undefined}
        actions={canManage ? <FiverrAccountActivationControl accountId={account.id} isActive={account.isActive} /> : undefined}
      />

      <Section title="Account">
        {canManage ? (
          <FiverrAccountForm
            mode="edit"
            accountId={account.id}
            initial={{ name: account.name, email: account.email, paypalEmail: account.paypalEmail, hasPaypalPassword: account.hasPaypalPassword }}
            canRevealCredentials={canRevealCredentials}
          />
        ) : (
          <dl className="grid grid-cols-1 gap-x-5 gap-y-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Email</dt>
              <dd className="mt-0.5 text-ink">{account.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">PayPal email</dt>
              <dd className="mt-0.5 text-ink">{account.paypalEmail ?? "—"}</dd>
            </div>
          </dl>
        )}
      </Section>

      {canManage && (
        <Section title="Gmail monitoring">
          <GmailMonitoringSection
            accountId={account.id}
            hasGmailAppPassword={account.hasGmailAppPassword}
            emailMonitoringEnabled={account.emailMonitoringEnabled}
            emailMonitoringSince={account.emailMonitoringSince}
            canRevealCredentials={canRevealCredentials}
          />
        </Section>
      )}

      <GigManager
        accountId={account.id}
        gigs={account.gigs.map((g) => ({ id: g.id, name: g.name, thumbnailUrl: g.thumbnailUrl, isActive: g.isActive }))}
        canManage={canManage}
      />
    </>
  );
}
