"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeft, X } from "lucide-react";
import { useEffect, useState } from "react";

import { FALLBACK_NAV_ICON, NAV_ICONS } from "@/components/layout/nav-icons";
import { setPersistedFlag, usePersistedFlag } from "@/components/layout/use-persisted-flag";
import { isNavNodeActive, type NavNode, type NavSection } from "@/lib/navigation/nav-tree";
import { cn } from "@/lib/utils";

/**
 * Application sidebar.
 *
 * Structural and quiet: text, spacing, subtle icons, a hairline active marker.
 * No colourful tiles, no neon active state, no rounded pill rows
 * (specification Sections 83 and 102).
 *
 * It receives an ALREADY-FILTERED tree. It performs no permission logic of its
 * own — that happens on the server, and the routes enforce it independently.
 *
 * On tablet/mobile it becomes an overlay drawer rather than a squeezed column.
 */

const OPEN_GROUPS_STORAGE_KEY = "bm.sidebar.openGroups";

export function Sidebar({ sections }: { sections: readonly NavSection[] }) {
  const pathname = usePathname();

  // The drawer is stored together with the path it was opened on, so navigating
  // closes it by DERIVATION rather than by a setState inside an effect (which
  // would cause a cascading render).
  const [drawer, setDrawer] = useState<{ open: boolean; path: string }>({
    open: false,
    path: pathname,
  });
  const drawerOpen = drawer.open && drawer.path === pathname;
  const setDrawerOpen = (open: boolean) => setDrawer({ open, path: pathname });

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Functional update: keeps `setDrawer` (a stable setter) as the only
      // dependency, rather than closing over the current pathname.
      if (event.key === "Escape") setDrawer((current) => ({ ...current, open: false }));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation"
        aria-expanded={drawerOpen}
        className="fixed left-3 top-3 z-30 inline-flex size-8 items-center justify-center rounded-[3px] border border-line bg-canvas text-ink-muted hover:text-ink lg:hidden"
      >
        <PanelLeft aria-hidden="true" className="size-4" />
      </button>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/20 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <nav
        aria-label="Main"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-sidebar flex-col overflow-y-auto",
          "border-r border-line bg-canvas-subtle",
          "transition-transform lg:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 pb-6 pt-5">
          <Link href="/dashboard" className="text-[13px] font-medium tracking-[-0.01em] text-ink-strong">
            Business Manager
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="inline-flex size-6 items-center justify-center text-ink-faint hover:text-ink lg:hidden"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 px-3 pb-8">
          {sections.map((section) => (
            <SidebarSection key={section.label} section={section} pathname={pathname} />
          ))}
        </div>
      </nav>
    </>
  );
}

function SidebarSection({ section, pathname }: { section: NavSection; pathname: string }) {
  return (
    <div>
      <p className="section-title px-2 pb-1.5">{section.label}</p>
      <ul className="space-y-px">
        {section.items.map((item) => (
          <li key={`${section.label}-${item.href}-${item.label}`}>
            {item.children && item.children.length > 0 ? (
              <SidebarGroup node={item} pathname={pathname} />
            ) : (
              <SidebarLink node={item} pathname={pathname} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarLink({
  node,
  pathname,
  nested = false,
}: {
  node: NavNode;
  pathname: string;
  nested?: boolean;
}) {
  const active = isNavNodeActive(node, pathname);
  const Icon = node.icon ? (NAV_ICONS[node.icon] ?? FALLBACK_NAV_ICON) : null;

  return (
    <Link
      href={node.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-[13px] transition-colors",
        nested && "pl-8",
        active ? "bg-zinc-200/60 font-medium text-ink-strong" : "text-ink-muted hover:bg-zinc-200/40 hover:text-ink",
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn("size-4 shrink-0", active ? "text-ink" : "text-ink-faint group-hover:text-ink-muted")}
        />
      ) : null}
      <span className="truncate">{node.label}</span>
    </Link>
  );
}

function SidebarGroup({ node, pathname }: { node: NavNode; pathname: string }) {
  const containsActive =
    isNavNodeActive(node, pathname) ||
    (node.children ?? []).some((child) => isNavNodeActive(child, pathname));

  const storageKey = `${OPEN_GROUPS_STORAGE_KEY}.${node.href}`;

  // The section containing the current page is ALWAYS open — a sidebar that
  // hides where you currently are is disorienting. For every other section the
  // user's last choice wins, read without an effect (no cascading render).
  const persisted = usePersistedFlag(storageKey, false);
  const open = containsActive || persisted;
  const toggle = () => setPersistedFlag(storageKey, !open);

  const Icon = node.icon ? (NAV_ICONS[node.icon] ?? FALLBACK_NAV_ICON) : null;
  const panelId = `nav-group-${node.href.replace(/[^\w-]/g, "-")}`;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "group flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-[13px] transition-colors",
          containsActive ? "font-medium text-ink-strong" : "text-ink-muted hover:bg-zinc-200/40 hover:text-ink",
        )}
      >
        {Icon ? (
          <Icon
            aria-hidden="true"
            className={cn("size-4 shrink-0", containsActive ? "text-ink" : "text-ink-faint group-hover:text-ink-muted")}
          />
        ) : null}
        <span className="flex-1 truncate text-left">{node.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 text-ink-faint transition-transform", open && "rotate-180")}
        />
      </button>
      <ul id={panelId} hidden={!open} className="mt-px space-y-px">
        {(node.children ?? []).map((child) => (
          <li key={`${child.href}-${child.label}`}>
            <SidebarLink node={child} pathname={pathname} nested />
          </li>
        ))}
      </ul>
    </>
  );
}
