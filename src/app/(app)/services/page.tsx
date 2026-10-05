import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { SearchFilter } from "@/components/filters/search-filter";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusDot } from "@/components/ui/status-dot";
import { listAssignableCategories } from "@/lib/categories/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { SERVICE_METRIC_TYPE_LABELS } from "@/lib/services/metric-type";
import { listServices, MAX_PAGE_SIZE, SERVICES_PAGE_SIZE } from "@/lib/services/queries";

export const metadata: Metadata = { title: "Services" };

const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(SERVICES_PAGE_SIZE),
  inactive: z.enum(["1", "0"]).catch("0"),
});

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const actor = await requirePermission("services.view");

  const raw = await searchParams;
  const params = searchParamsSchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
    page: raw.page ?? 1,
    size: raw.size ?? SERVICES_PAGE_SIZE,
    inactive: raw.inactive ?? "0",
  });

  const [result, categories] = await Promise.all([
    listServices({
      page: params.page,
      pageSize: params.size,
      search: params.q,
      categoryId: params.category,
      includeInactive: params.inactive === "1",
    }),
    listAssignableCategories(),
  ]);

  const activeCategory = categories.find((category) => category.id === params.category);

  const buildHref = (target: number) => {
    const url = new URLSearchParams();
    if (params.q) url.set("q", params.q);
    if (params.category) url.set("category", params.category);
    if (params.size !== SERVICES_PAGE_SIZE) url.set("size", String(params.size));
    if (params.inactive === "1") url.set("inactive", "1");
    if (target > 1) url.set("page", String(target));
    const search = url.toString();
    return search ? `/services?${search}` : "/services";
  };

  return (
    <>
      <Breadcrumbs items={[{ label: "Services" }, { label: "Services" }]} />
      <PageHeader
        title="Services"
        description={
          activeCategory
            ? `Showing services in ${activeCategory.name}.`
            : "The sellable service catalog (specification Section 50)."
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/categories" className={buttonVariants({ variant: "secondary" })}>
              Categories
            </Link>
            {actor.permissions.has("services.create") ? (
              <Link href="/services/new" className={buttonVariants({ variant: "primary" })}>
                New service
              </Link>
            ) : null}
          </div>
        }
      />

      <SearchFilter
        id="service-search"
        label="Search services by name"
        placeholder="Search services by name…"
        initialSearch={params.q ?? ""}
        toggle={{ paramKey: "inactive", label: "Include inactive", checked: params.inactive === "1" }}
      />

      {activeCategory ? (
        <p className="-mt-4 mb-6 text-xs text-ink-faint">
          Filtered by category: {activeCategory.name} ·{" "}
          <Link href="/services" className="hover:text-ink hover:underline">
            Clear
          </Link>
        </p>
      ) : null}

      <Section>
        {result.rows.length === 0 ? (
          <EmptyState
            title="No services found"
            description={
              params.q || activeCategory
                ? "No service matches these filters."
                : "Add the first service under a category."
            }
            action={
              !params.q && !activeCategory && actor.permissions.has("services.create") ? (
                <Link href="/services/new" className={buttonVariants({ variant: "primary" })}>
                  New service
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <caption className="sr-only">Services</caption>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Category</TH>
                    <TH>Metric type</TH>
                    <TH className="text-right">Base price</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {result.rows.map((service) => (
                    <TR key={service.id}>
                      <TD>
                        <Link href={`/services/${service.id}`} className="font-medium text-ink hover:underline">
                          {service.name}
                        </Link>
                      </TD>
                      <TD className="text-ink-muted">{service.categoryName}</TD>
                      <TD className="text-ink-muted">
                        {service.metricType ? (
                          SERVICE_METRIC_TYPE_LABELS[service.metricType]
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </TD>
                      <TD className="text-right text-ink-muted">
                        {service.basePrice ? (
                          `${service.basePrice} ${service.currency}`
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </TD>
                      <TD>
                        <StatusDot
                          tone={service.isActive ? "done" : "neutral"}
                          label={service.isActive ? "Active" : "Inactive"}
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
              itemLabel="service"
              buildHref={buildHref}
            />
          </>
        )}
      </Section>
    </>
  );
}
