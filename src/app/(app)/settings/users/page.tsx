import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listUsers, MAX_PAGE_SIZE, USERS_PAGE_SIZE } from "@/lib/access/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { UserListControls } from "./user-list-controls";

export const metadata: Metadata = { title: "Users" };

/**
 * List state lives in the URL (specification Section 30), so a filtered view is
 * bookmarkable and shareable. The parameters are VALIDATED, not trusted: an
 * out-of-range page size or a junk page number is coerced to a safe default
 * rather than passed to the database.
 */
const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(USERS_PAGE_SIZE),
  inactive: z.enum(["1", "0"]).catch("0"),
});

export default async function UsersPage({ searchParams }: PageProps<"/settings/users">) {
  const actor = await requirePermission("users.view");

  const raw = await searchParams;
  const params = searchParamsSchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    page: raw.page ?? 1,
    size: raw.size ?? USERS_PAGE_SIZE,
    inactive: raw.inactive ?? "0",
  });

  const result = await listUsers({
    page: params.page,
    pageSize: params.size,
    search: params.q,
    includeInactive: params.inactive === "1",
  });

  return (
    <>
      <Breadcrumbs items={[{ label: "Settings" }, { label: "Users" }]} />
      <PageHeader
        title="Users"
        description="Application users, their roles and any direct permission overrides."
        actions={
          actor.permissions.has("users.create") ? (
            <Link href="/settings/users/new" className={buttonVariants({ variant: "primary" })}>
              New user
            </Link>
          ) : undefined
        }
      />

      <UserListControls
        initialSearch={params.q ?? ""}
        includeInactive={params.inactive === "1"}
      />

      <Section>
        {result.rows.length === 0 ? (
          <EmptyState
            title="No users found"
            description={
              params.q
                ? "No user matches that search. Try a different name or email address."
                : "Users are created by an administrator. Run the seed to create the first Super Admin."
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <caption className="sr-only">Application users</caption>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Email</TH>
                    <TH>Roles</TH>
                    <TH className="text-right">Overrides</TH>
                    <TH>Status</TH>
                    <TH>Sign-in</TH>
                  </TR>
                </THead>
                <TBody>
                  {result.rows.map((user) => (
                    <TR key={user.id}>
                      <TD>
                        <Link
                          href={`/settings/users/${user.id}`}
                          className="font-medium text-ink hover:underline"
                        >
                          {user.fullName}
                        </Link>
                        {user.jobTitle ? (
                          <span className="block text-xs text-ink-faint">{user.jobTitle}</span>
                        ) : null}
                      </TD>
                      <TD className="text-ink-muted">{user.email}</TD>
                      <TD className="text-ink-muted">
                        {user.roleNames.length > 0 ? (
                          user.roleNames.join(", ")
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </TD>
                      <TD className="text-right text-ink-muted">
                        {user.directOverrideCount > 0 ? user.directOverrideCount : <span className="text-ink-faint">—</span>}
                      </TD>
                      <TD>
                        <StatusDot
                          tone={user.isActive ? "done" : "neutral"}
                          label={user.isActive ? "Active" : "Inactive"}
                        />
                      </TD>
                      <TD>
                        <StatusDot
                          tone={user.hasSignIn ? "done" : "warning"}
                          label={user.hasSignIn ? "Linked" : "No credentials"}
                        />
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
              query={{ q: params.q, size: params.size, inactive: params.inactive }}
            />
          </>
        )}
      </Section>
    </>
  );
}

function Pagination({
  page,
  pageCount,
  total,
  query,
}: {
  page: number;
  pageCount: number;
  total: number;
  query: { q?: string; size: number; inactive: string };
}) {
  const buildHref = (target: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.size !== USERS_PAGE_SIZE) params.set("size", String(query.size));
    if (query.inactive === "1") params.set("inactive", "1");
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `/settings/users?${search}` : "/settings/users";
  };

  return (
    <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
      <p>
        Page {page} of {pageCount} · {total} {total === 1 ? "user" : "users"}
      </p>
      <div className="flex items-center gap-3">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className="hover:text-ink hover:underline">
            Previous
          </Link>
        ) : (
          <span className="text-ink-faint">Previous</span>
        )}
        {page < pageCount ? (
          <Link href={buildHref(page + 1)} className="hover:text-ink hover:underline">
            Next
          </Link>
        ) : (
          <span className="text-ink-faint">Next</span>
        )}
      </div>
    </div>
  );
}
