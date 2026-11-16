import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { SearchFilter } from "@/components/filters/search-filter";
import { NewCustomerButton } from "./new-customer-button";
import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { CUSTOMERS_PAGE_SIZE, listCustomers, MAX_PAGE_SIZE } from "@/lib/customers/queries";

export const metadata: Metadata = { title: "Customers" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(CUSTOMERS_PAGE_SIZE),
  new: z.literal("1").optional().catch(undefined),
});

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const actor = await requirePermission("customers.view");

  const raw = await searchParams;
  const params = searchParamsSchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    page: raw.page ?? 1,
    size: raw.size ?? CUSTOMERS_PAGE_SIZE,
    new: raw.new,
  });
  const canCreate = actor.permissions.has("customers.create");

  const result = await listCustomers({ page: params.page, pageSize: params.size, search: params.q });

  const buildHref = (target: number) => {
    const url = new URLSearchParams();
    if (params.q) url.set("q", params.q);
    if (params.size !== CUSTOMERS_PAGE_SIZE) url.set("size", String(params.size));
    if (target > 1) url.set("page", String(target));
    const search = url.toString();
    return search ? `/customers?${search}` : "/customers";
  };

  return (
    <>
      <Breadcrumbs items={[{ label: "CRM" }, { label: "Customers" }]} />
      <PageHeader
        title="Customers"
        description="The end/job customer for an order."
        actions={
          canCreate ? <NewCustomerButton defaultOpen={params.new === "1"} /> : undefined
        }
      />

      <SearchFilter
        id="customer-search"
        label="Search customers by name or email"
        placeholder="Search customers by name or email…"
        initialSearch={params.q ?? ""}
      />

      <Section>
        {result.rows.length === 0 ? (
          <EmptyState
            title="No customers found"
            description={
              params.q
                ? "No customer matches that search."
                : "Add the first customer."
            }
            action={
              !params.q && canCreate ? <NewCustomerButton label="Add the first customer" /> : undefined
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <caption className="sr-only">Customers</caption>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Type</TH>
                    <TH>Email</TH>
                    <TH>Phone</TH>
                    <TH className="text-right">Orders</TH>
                    <TH>Last order</TH>
                  </TR>
                </THead>
                <TBody>
                  {result.rows.map((customer) => (
                    <TR key={customer.id}>
                      <TD>
                        <Link href={`/customers/${customer.id}`} className="font-medium text-ink hover:underline">
                          {customer.name}
                        </Link>
                        {customer.username !== customer.name ? <span className="block text-xs text-ink-muted">@{customer.username}</span> : null}
                      </TD>
                      <TD className="text-ink-muted">
                        {customer.type === "COMPANY" ? "Company" : "Individual"}
                      </TD>
                      <TD className="text-ink-muted">
                        {customer.email ?? <span className="text-ink-faint">—</span>}
                      </TD>
                      <TD className="text-ink-muted">
                        {customer.phone ?? <span className="text-ink-faint">—</span>}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {customer.orderCount > 0 ? (
                          <Link href={`/customers/${customer.id}#orders`} className="font-medium text-indigo-600 hover:underline">
                            {customer.orderCount}
                          </Link>
                        ) : (
                          <span className="text-ink-faint">0</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-ink-muted">
                        {customer.lastOrderAt ? dateFormat.format(customer.lastOrderAt) : <span className="text-ink-faint">—</span>}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              itemLabel="customer"
              buildHref={buildHref}
            />
          </>
        )}
      </Section>
    </>
  );
}
