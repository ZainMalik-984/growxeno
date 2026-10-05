import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { listFiverrAccounts } from "@/lib/fiverr-accounts/queries";

export const metadata: Metadata = { title: "Fiverr Accounts" };

/**
 * The business's own Fiverr seller profiles (confirmed directly, 2026-09-27) —
 * bookkeeping records so an order can note which profile it landed on, never
 * an integration with Fiverr itself (no API, no scraping, ever).
 */
export default async function FiverrAccountsPage() {
  const actor = await requirePermission("fiverr_accounts.view");
  const accounts = await listFiverrAccounts();

  return (
    <>
      <Breadcrumbs items={[{ label: "Fiverr" }, { label: "Accounts" }]} />
      <PageHeader
        title="Fiverr Accounts"
        description="Your seller profiles. Which one an order came in on is recorded on the order itself."
        actions={
          actor.permissions.has("fiverr_accounts.manage") ? (
            <Link href="/fiverr-accounts/new" className={buttonVariants({ variant: "primary" })}>
              New account
            </Link>
          ) : undefined
        }
      />

      <Section>
        {accounts.length === 0 ? (
          <EmptyState title="No Fiverr accounts yet" description="Add one to record which profile an order came in on." />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Fiverr accounts</caption>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH className="text-right">Gigs</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {accounts.map((account) => (
                  <TR key={account.id}>
                    <TD>
                      <Link href={`/fiverr-accounts/${account.id}`} className="font-medium text-ink hover:underline">
                        {account.name}
                      </Link>
                    </TD>
                    <TD className="text-ink-muted">{account.email ?? <span className="text-ink-faint">—</span>}</TD>
                    <TD className="text-right text-ink-muted">{account.gigCount}</TD>
                    <TD>
                      <StatusDot tone={account.isActive ? "done" : "neutral"} label={account.isActive ? "Active" : "Inactive"} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Section>

      <Section title="Go to">
        <Link href="/fiverr-accounts/gigs" className="text-[13px] text-ink hover:underline">
          Gigs (daily stats and charts)
        </Link>
      </Section>
    </>
  );
}
