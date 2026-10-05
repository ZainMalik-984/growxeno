import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Page furniture: breadcrumbs, page header, section, empty state.
 *
 * These exist so that every screen has the same vertical rhythm without each
 * one inventing its own wrapper. None of them draws a card.
 */

export type Crumb = { label: string; href?: string };

/** Restrained breadcrumbs. Small, muted, never visually dominant (Section 85). */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-faint">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-ink-muted hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className={cn(isLast && "text-ink-muted")} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast ? <ChevronRight aria-hidden="true" className="size-3" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-xl font-medium tracking-[-0.01em] text-ink-strong">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A titled band of content flowing directly on the canvas — not a card. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-10", className)}>
      {title ? (
        <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-line pb-2">
          <div>
            <h2 className="section-title">{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-ink-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Useful empty state: says what is missing and what to do (Section 135). */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-12 text-center">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A short definition list used on detail pages for metadata. */
export function MetaList({
  items,
  className,
}: {
  items: ReadonlyArray<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[11px] uppercase tracking-[0.06em] text-ink-faint">{item.label}</dt>
          <dd className="mt-1 text-[13px] text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
