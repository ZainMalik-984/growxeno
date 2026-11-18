"use client";

import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { SURFACE_CLASS } from "@/components/ui/page";
import { DASHBOARD_PATH } from "@/lib/routing/hosts";
import { cn } from "@/lib/utils";

/** The list each kind of record lives in: what to call it and where to go back to. */
const SECTIONS: { prefix: string; thing: string; list: string; href: string }[] = [
  { prefix: "/orders", thing: "order", list: "Orders", href: "/orders" },
  { prefix: "/customers", thing: "customer", list: "Customers", href: "/customers" },
  { prefix: "/inquiries", thing: "inquiry", list: "Inquiries", href: "/inquiries" },
  { prefix: "/fiverr-accounts", thing: "Fiverr account", list: "Fiverr accounts", href: "/fiverr-accounts" },
  { prefix: "/employees", thing: "employee", list: "Employees", href: "/employees" },
  { prefix: "/outsourced-workers", thing: "worker", list: "Outsourced workers", href: "/outsourced-workers" },
  { prefix: "/services", thing: "service", list: "Services", href: "/services" },
  { prefix: "/categories", thing: "category", list: "Categories", href: "/categories" },
  { prefix: "/invoices", thing: "invoice", list: "Invoices", href: "/invoices" },
  { prefix: "/settings/users", thing: "user", list: "Users", href: "/settings/users" },
  { prefix: "/settings/roles", thing: "role", list: "Roles", href: "/settings/roles" },
];

export function InAppNotFound() {
  const pathname = usePathname() ?? "";
  const section = SECTIONS.find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`)) ?? null;
  const thing = section?.thing ?? "page";

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-10">
      <div className={cn(SURFACE_CLASS, "w-full max-w-md px-6 py-10 text-center sm:px-10")}>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-zinc-100 text-zinc-500 ring-8 ring-zinc-50">
          <SearchX aria-hidden className="size-5" />
        </span>
        <h1 className="mt-5 text-[18px] font-semibold tracking-[-0.01em] text-zinc-900">
          {section ? `This ${thing} doesn't exist` : "Page not found"}
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-zinc-500">
          {section
            ? `It may have been deleted, or you don't have access to it. Check the link, or find it in ${section.list}.`
            : "This page doesn't exist, or you don't have access to it."}
        </p>
        <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
          <Link href={DASHBOARD_PATH} className={buttonVariants({ variant: "secondary" })}>
            Dashboard
          </Link>
          {section ? (
            <Link href={section.href} className={buttonVariants({ variant: "primary" })}>
              <ArrowLeft aria-hidden /> Back to {section.list.toLowerCase()}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
