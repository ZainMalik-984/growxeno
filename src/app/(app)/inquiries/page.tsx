import { Mail, MessageSquareText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompactEmpty } from "@/components/ui/metric";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-dot";
import { requirePermission } from "@/lib/auth/authorize";
import { countInquiriesByStatus, listInquiries } from "@/lib/inquiries/queries";
import { INQUIRY_STATUS_LABELS } from "@/lib/inquiries/schema";
import { INQUIRY_TONE } from "@/lib/inquiries/tone";
import { cn } from "@/lib/utils";
import { InquiryActions } from "./inquiry-actions";

export const metadata: Metadata = { title: "Inquiries" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

const searchSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "CLOSED", "ALL"]).catch("NEW"),
  q: z.string().trim().max(120).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

/**
 * Website inquiries (2026-11-04): what visitors send through the contact
 * form on the public home page. Opens on New so nothing waits unseen.
 */
export default async function InquiriesPage({ searchParams }: PageProps<"/inquiries">) {
  const actor = await requirePermission("inquiries.view");
  const params = searchSchema.parse(await searchParams);
  const canManage = actor.permissions.has("inquiries.manage");

  const [result, counts] = await Promise.all([
    listInquiries({ status: params.status === "ALL" ? undefined : params.status, search: params.q, page: params.page }),
    countInquiriesByStatus(),
  ]);
  const total = counts.NEW + counts.CONTACTED + counts.CLOSED;

  const href = (next: Partial<{ status: string; page: number }>) => {
    const url = new URLSearchParams();
    const status = next.status ?? params.status;
    if (status !== "NEW") url.set("status", status);
    if (params.q) url.set("q", params.q);
    if (next.page && next.page > 1) url.set("page", String(next.page));
    const qs = url.toString();
    return qs ? `/inquiries?${qs}` : "/inquiries";
  };

  const tabs: Array<{ key: "NEW" | "CONTACTED" | "CLOSED" | "ALL"; label: string; count: number }> = [
    { key: "NEW", label: "New", count: counts.NEW },
    { key: "CONTACTED", label: "Contacted", count: counts.CONTACTED },
    { key: "CLOSED", label: "Closed", count: counts.CLOSED },
    { key: "ALL", label: "All", count: total },
  ];

  return (
    <>
      <Breadcrumbs items={[{ label: "CRM" }, { label: "Inquiries" }]} />
      <PageHeader title="Inquiries" description="Messages sent through the contact form on the website." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Inquiry status" className="inline-flex gap-1 rounded-[9px] bg-zinc-100 p-1 ring-1 ring-inset ring-zinc-200/70">
          {tabs.map((tab) => {
            const active = tab.key === params.status;
            return (
              <Link
                key={tab.key}
                href={href({ status: tab.key, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition",
                  active ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-zinc-500 hover:text-zinc-800",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    tab.key === "NEW" && tab.count > 0 ? "bg-indigo-600 text-white" : "bg-zinc-200/70 text-zinc-600",
                  )}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </nav>

        <form action="/inquiries" className="relative w-full sm:w-72">
          {params.status !== "NEW" ? <input type="hidden" name="status" value={params.status} /> : null}
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search name, email or message"
            aria-label="Search inquiries"
            className="h-9 w-full rounded-[8px] border border-zinc-200 bg-white pl-9 pr-3 text-[13px] outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
        </form>
      </div>

      {result.rows.length === 0 ? (
        <Card className="p-5 sm:p-6">
          <CompactEmpty
            icon={MessageSquareText}
            title={params.q ? "No inquiries match your search" : params.status === "NEW" ? "No new inquiries" : "Nothing here yet"}
            description={
              params.q
                ? "Try another name, email or word."
                : "When someone sends the contact form on the website, it appears here."
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {result.rows.map((inquiry) => (
            <li key={inquiry.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-zinc-900">{inquiry.name}</p>
                      <StatusBadge tone={INQUIRY_TONE[inquiry.status]} label={INQUIRY_STATUS_LABELS[inquiry.status]} />
                      {inquiry.service ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200">
                          {inquiry.service}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[13px] text-zinc-500">
                      <a href={`mailto:${inquiry.email}`} className="text-indigo-600 hover:underline">
                        {inquiry.email}
                      </a>
                      <span aria-hidden="true"> · </span>
                      {dateFormat.format(inquiry.createdAt)} UTC
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Re: your inquiry${inquiry.service ? ` — ${inquiry.service}` : ""}`)}`}
                      className={buttonVariants({ variant: "secondary", size: "sm", className: "rounded-[8px]" })}
                    >
                      <Mail aria-hidden="true" />
                      Reply by email
                    </a>
                    {canManage ? <InquiryActions inquiryId={inquiry.id} status={inquiry.status} /> : null}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words rounded-[10px] bg-zinc-50 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-800 ring-1 ring-inset ring-zinc-200/70">
                  {inquiry.message}
                </p>
                {inquiry.handledBy && inquiry.handledAt ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    {INQUIRY_STATUS_LABELS[inquiry.status]} by {inquiry.handledBy} · {dateFormat.format(inquiry.handledAt)} UTC
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 ? (
        <div className="mt-4">
          <Pagination page={params.page} pageCount={result.pageCount} total={result.total} itemLabel="inquiry" buildHref={(page) => href({ page })} />
        </div>
      ) : null}
    </>
  );
}
