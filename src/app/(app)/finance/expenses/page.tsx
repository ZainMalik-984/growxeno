import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader, Section } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusDot } from "@/components/ui/status-dot";
import { requirePermission } from "@/lib/auth/authorize";
import { listAssignableExpenseCategories, listExpenseCategories, listExpenses, MAX_PAGE_SIZE, FINANCE_PAGE_SIZE } from "@/lib/finance/queries";
import { listAssignableWorkers } from "@/lib/orders/queries";
import { CategoryActiveToggle } from "./category-active-toggle";
import { CategoryManager } from "./category-manager";
import { ExpenseForm, EditExpenseButton } from "./expense-form";

export const metadata: Metadata = { title: "Expenses" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

const searchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(FINANCE_PAGE_SIZE),
});

export default async function ExpensesPage({ searchParams }: PageProps<"/finance/expenses">) {
  const actor = await requirePermission("finance.expenses.view");
  const raw = await searchParams;
  const params = searchParamsSchema.parse(raw);

  const canCreate = actor.permissions.has("finance.expenses.create");
  const canEdit = actor.permissions.has("finance.expenses.edit");

  const [result, categories, allCategories, users] = await Promise.all([
    listExpenses({ page: params.page, pageSize: params.size }),
    listAssignableExpenseCategories(),
    listExpenseCategories(true),
    listAssignableWorkers(),
  ]);

  const buildHref = (target: number) => (target > 1 ? `/finance/expenses?page=${target}` : "/finance/expenses");

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Recorded costs — optionally tied to an order, but always shown separately from revenue."
        actions={canCreate ? <ExpenseForm categories={categories} users={users} canCreate /> : undefined}
      />

      <Section title="Entries">
        {result.rows.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No expenses recorded yet.</p>
        ) : (
          <>
            <TableWrap>
              <Table>
                <caption className="sr-only">Expenses</caption>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Category</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Order</TH>
                    <TH>Paid by</TH>
                    <TH>Description</TH>
                    {canEdit ? <TH /> : null}
                  </TR>
                </THead>
                <TBody>
                  {result.rows.map((row) => (
                    <TR key={row.id}>
                      <TD className="text-ink-muted">{dateFormat.format(row.date)}</TD>
                      <TD className="text-ink-muted">{row.categoryName}</TD>
                      <TD className="text-right text-ink-muted">
                        {row.amount} {row.currency}
                      </TD>
                      <TD className="text-ink-muted">{row.orderNumber ? `#${row.orderNumber}` : <span className="text-ink-faint">—</span>}</TD>
                      <TD className="text-ink-muted">{row.paidByName ?? <span className="text-ink-faint">—</span>}</TD>
                      <TD className="max-w-xs truncate text-ink-muted">{row.description ?? <span className="text-ink-faint">—</span>}</TD>
                      {canEdit ? (
                        <TD>
                          <EditExpenseButton row={row} categories={categories} users={users} />
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            <Pagination page={result.page} pageCount={result.pageCount} total={result.total} itemLabel="expense" buildHref={buildHref} />
          </>
        )}
      </Section>

      {canEdit ? (
        <Section title="Categories" description="Configurable — add, rename, or deactivate as needed.">
          <ul className="space-y-2">
            {allCategories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-ink">
                  {category.name} <span className="text-ink-faint">· {category.expenseCount} expense{category.expenseCount === 1 ? "" : "s"}</span>
                </span>
                <div className="flex items-center gap-2">
                  <StatusDot tone={category.isActive ? "done" : "neutral"} label={category.isActive ? "Active" : "Inactive"} />
                  <CategoryActiveToggle id={category.id} isActive={category.isActive} />
                </div>
              </li>
            ))}
          </ul>
          <CategoryManager />
        </Section>
      ) : null}
    </>
  );
}
