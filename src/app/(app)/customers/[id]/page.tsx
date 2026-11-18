import type { Metadata } from "next";
import { Building2, CalendarDays, Mail, Phone, StickyNote, UserRound } from "lucide-react";
import Link from "next/link";
import { SiWhatsapp } from "react-icons/si";
import { customerWhatsappUrl } from "@/lib/customers/whatsapp";
import { notFound } from "next/navigation";

import { Card, PHONE_FLUSH } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { getCustomerDetail, getCustomerOrderStats } from "@/lib/customers/queries";
import { listOrders } from "@/lib/orders/queries";
import { unreadUpdatesByItem } from "@/lib/notifications/item-updates-unread.server";
import { orderVisibility } from "@/lib/orders/visibility";
import { cn } from "@/lib/utils";
import { toOrdersTableRows } from "../../orders/order-table-rows";
import { OrdersTable } from "../../orders/orders-table";
import { CustomerDeleteControl } from "./customer-delete-control";
import { CustomerEditButton } from "./customer-profile-form";
import { isUuid } from "@/lib/validation/url-params";

export const metadata: Metadata = { title: "Customer" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });
const moneyFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * A customer (redesigned 2026-11-15, owner request: "very outdated and not
 * professional"): a header with who they are, how to reach them and their
 * order figures; their orders as the main column; the rest in a side card.
 * Editing opens in a popup. Orders and money only show to people allowed to
 * see them (src/lib/orders/visibility.ts), decided here on the server.
 */
export default async function CustomerDetailPage({ params }: PageProps<"/customers/[id]">) {
  const actor = await requirePermission("customers.view");
  const { id } = await params;
  // A malformed id (a truncated or hand-edited link) can't name a record: not found, not a 500.
  if (!isUuid(id)) notFound();

  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  const canEdit = actor.permissions.has("customers.edit");
  const canDelete = actor.permissions.has("customers.delete");
  const visibility = orderVisibility((key) => actor.permissions.has(key));
  const canSeeOrders = actor.permissions.has("orders.view") && visibility.allItems;

  const [orders, stats] = canSeeOrders
    ? await Promise.all([
        listOrders({ customerId: customer.id, page: 1, pageSize: 25 }, { mode: "ALL" }).then(async (result) => ({
          total: result.total,
          rows: toOrdersTableRows(result.rows, {
            identity: { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId },
            visibility,
            canChangeItemStatus: actor.permissions.has("orders.change_status"),
            unreadByItem: await unreadUpdatesByItem(actor.user.id),
          }),
        })),
        getCustomerOrderStats(customer.id),
      ])
    : [null, null];

  const TypeIcon = customer.type === "COMPANY" ? Building2 : UserRound;
  const whatsappLink = customerWhatsappUrl(customer.whatsappNumber);

  return (
    <>
      <Breadcrumbs items={[{ label: "CRM" }, { label: "Customers", href: "/customers" }, { label: customer.name }]} />

      <div className="space-y-6">
        {/* Who they are, how to reach them, what they've ordered. */}
        <Card className={cn("p-0 sm:p-0", PHONE_FLUSH)}>
          <div className="flex flex-wrap items-start gap-4 px-5 py-5 sm:px-6">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[18px] font-semibold text-white"
            >
              {initials(customer.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[20px] font-semibold leading-tight text-zinc-900">{customer.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-zinc-500">
                <span className="font-medium text-zinc-700">@{customer.username}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <TypeIcon aria-hidden="true" className="size-3.5" />
                  {customer.type === "COMPANY" ? "Company" : "Individual"}
                </span>
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px]">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700 hover:bg-zinc-200">
                    <Mail aria-hidden="true" className="size-3.5 text-zinc-500" />
                    {customer.email}
                  </a>
                ) : null}
                {customer.phone ? (
                  <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700 hover:bg-zinc-200">
                    <Phone aria-hidden="true" className="size-3.5 text-zinc-500" />
                    {customer.phone}
                  </a>
                ) : null}
                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"
                  >
                    <SiWhatsapp aria-hidden="true" className="size-3.5 text-[#25D366]" />
                    {customer.whatsappNumber}
                    <span className="sr-only">(opens WhatsApp)</span>
                  </a>
                ) : null}
                {!customer.email && !customer.phone && !whatsappLink ? <span className="text-zinc-400">No contact details yet</span> : null}
              </div>
            </div>
            {canEdit || canDelete ? (
              <div className="flex shrink-0 items-center gap-1.5">
                {canEdit ? <CustomerEditButton customer={customer} /> : null}
                {canDelete ? <CustomerDeleteControl customerId={customer.id} name={customer.name} /> : null}
              </div>
            ) : null}
          </div>

          {stats ? (
            <dl className="grid grid-cols-2 border-t border-zinc-100 sm:grid-cols-4 [&>div]:px-5 [&>div]:py-3.5 sm:[&>div]:px-6 [&>div+div]:border-l [&>div+div]:border-zinc-100 max-sm:[&>div:nth-child(3)]:border-l-0 max-sm:[&>div:nth-child(n+3)]:border-t">
              <Stat label="Orders" value={String(stats.orderCount)} />
              <Stat label="Open" value={String(stats.openCount)} />
              <Stat
                label="Spent"
                value={
                  visibility.prices
                    ? stats.spent.length
                      ? stats.spent.map((s) => `${moneyFormat.format(Number(s.amount))} ${s.currency}`).join(" · ")
                      : "0"
                    : "—"
                }
              />
              <Stat label="Last order" value={stats.lastOrderAt ? dateFormat.format(stats.lastOrderAt) : "—"} />
            </dl>
          ) : null}
        </Card>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {orders ? (
            <section id="orders" className="min-w-0 scroll-mt-20">
              <Card className={cn("overflow-hidden p-0 sm:p-0", PHONE_FLUSH)}>
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                  <h2 className="text-[15px] font-semibold text-zinc-900">
                    Orders
                    <span className="ml-1.5 text-[13px] font-normal tabular-nums text-zinc-500">({orders.total})</span>
                  </h2>
                  {orders.total > orders.rows.length ? (
                    <Link href={`/orders?customer=${customer.id}`} className="text-[13px] font-medium text-indigo-600 hover:underline">
                      See all
                    </Link>
                  ) : null}
                </div>
                {orders.rows.length === 0 ? (
                  <p className="border-t border-zinc-100 px-6 py-8 text-center text-[13px] text-zinc-500">No orders for this customer yet.</p>
                ) : (
                  <OrdersTable canPostUpdates rows={orders.rows} showCustomer={false} showAmount={visibility.prices} />
                )}
              </Card>
            </section>
          ) : (
            <div className="hidden xl:block" />
          )}

          <Card className={cn("p-0 sm:p-0", PHONE_FLUSH)}>
            <h2 className="px-5 pt-4 text-[15px] font-semibold text-zinc-900">About</h2>
            <dl className="divide-y divide-zinc-100 px-5 pb-2 text-[13px]">
              <About icon={StickyNote} label="Notes">
                {customer.notes ? <span className="whitespace-pre-wrap text-zinc-700">{customer.notes}</span> : <span className="text-zinc-400">No notes</span>}
              </About>
              {stats?.firstOrderAt ? <About icon={CalendarDays} label="First order">{dateFormat.format(stats.firstOrderAt)}</About> : null}
              <About icon={CalendarDays} label="Customer since">{dateFormat.format(customer.createdAt)}</About>
              <About icon={CalendarDays} label="Updated">{dateFormat.format(customer.updatedAt)}</About>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate text-[17px] font-semibold tabular-nums text-zinc-900" title={value}>
        {value}
      </dd>
    </div>
  );
}

function About({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="py-3">
      <dt className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </dt>
      <dd className="text-zinc-800">{children}</dd>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}
