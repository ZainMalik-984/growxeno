import type { EffectivePermissions } from "@/lib/permissions/resolve";

/**
 * The application's information architecture, declared once.
 *
 * Shape: SECTION -> ITEM -> optional CHILDREN (two levels, no deeper — a third
 * level of nesting in a sidebar stops being scannable).
 *
 * Two independent filters are applied by `getNavigationFor`:
 *
 *   permission  the actor must hold the node's `permission` key, if it has one
 *   implemented the route must actually exist in this build
 *
 * `implemented: false` nodes are the committed information architecture for
 * later phases. They are deliberately NOT rendered: a sidebar full of links to
 * pages that do not exist is worse than a short sidebar. When a phase lands,
 * flip the flag — the structure, ordering and permission keys are already
 * decided here.
 *
 * Icons are stored as STRING keys, not component references, because this tree
 * is built on the server and passed to a Client Component; React components are
 * not serialisable across that boundary. The mapping lives in
 * src/components/layout/nav-icons.ts.
 *
 * REMINDER: this file is a UX concern. Filtering the tree hides links; it does
 * not protect anything. Each route enforces its own permission server-side.
 */

export type NavIconName =
  | "dashboard"
  | "bell"
  | "activity"
  | "orders"
  | "customers"
  | "fiverr"
  | "workers"
  | "stats"
  | "performance"
  | "payments"
  | "services"
  | "categories"
  | "finance"
  | "invoice"
  | "communication"
  | "reports"
  | "users"
  | "roles"
  | "permissions"
  | "settings";

export type NavNode = {
  readonly label: string;
  readonly href: string;
  /** Permission key required to see this node. Omitted = visible to any signed-in user. */
  readonly permission?: string;
  readonly icon?: NavIconName;
  /** Whether the route exists in this build. See the note above. */
  readonly implemented: boolean;
  /** Match the pathname exactly rather than by prefix (used for index routes). */
  readonly exact?: boolean;
  readonly children?: readonly NavNode[];
};

export type NavSection = {
  readonly label: string;
  readonly items: readonly NavNode[];
};

/**
 * The complete tree from specification Section 80, with the routes from
 * Section 84. Order-status views are query parameters on /orders rather than
 * duplicate routes, as Section 84 requires.
 */
export const NAVIGATION: readonly NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard", implemented: true, exact: true },
      { label: "Notifications", href: "/notifications", icon: "bell", implemented: true },
      { label: "Activity", href: "/activity", icon: "activity", permission: "audit.view", implemented: false },
    ],
  },
  {
    label: "Operations",
    items: [
      // One link (owner-directed, 2026-11-03): status views live as tabs with counts
      // on the Orders page itself, not as nine separate sidebar entries. The URL
      // params they used (?status=…, ?due=overdue) still work for old links.
      { label: "Orders", href: "/orders", icon: "orders", permission: "orders.view", implemented: true },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Customers", href: "/customers", icon: "customers", permission: "customers.view", implemented: true },
    ],
  },
  {
    label: "Fiverr",
    items: [
      {
        label: "Fiverr Accounts",
        href: "/fiverr-accounts",
        icon: "fiverr",
        permission: "fiverr_accounts.view",
        implemented: true,
        children: [
          { label: "Accounts", href: "/fiverr-accounts", permission: "fiverr_accounts.view", implemented: true, exact: true },
          { label: "Gigs", href: "/fiverr-accounts/gigs", permission: "fiverr_accounts.view", implemented: true },
        ],
      },
    ],
  },
  {
    label: "Workforce",
    items: [
      { label: "Employees", href: "/employees", icon: "workers", permission: "employees.view.all", implemented: true },
      // Third-party workers with no application account (not yet true once
      // the External Worker login portal lands — see the plan's Phase 3),
      // needed as soon as Order Items can be assigned (Phase 4) — see
      // prisma/schema/orders.prisma's `OutsourcedWorker` doc comment. Split
      // into its own permission module, 2026-10-08 (owner-directed: "keep
      // the External Workers separate from employees") — previously reused
      // the internal Worker/Employee module's keys.
      {
        label: "Outsourced Workers",
        href: "/outsourced-workers",
        icon: "workers",
        permission: "outsourced_workers.view",
        implemented: true,
      },
      { label: "Daily Statistics", href: "/daily-stats", icon: "stats", permission: "daily_stats.view", implemented: true },
      { label: "Performance", href: "/performance", icon: "performance", permission: "employees.stats.view", implemented: false },
      { label: "Payments", href: "/worker-payments", icon: "payments", permission: "employees.payments.view", implemented: false },
    ],
  },
  {
    label: "Services",
    items: [
      { label: "Services", href: "/services", icon: "services", permission: "services.view", implemented: true },
      { label: "Categories", href: "/categories", icon: "categories", permission: "categories.view", implemented: true },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Finance",
        href: "/finance",
        icon: "finance",
        permission: "finance.view",
        implemented: true,
        children: [
          { label: "Overview", href: "/finance", permission: "finance.view", implemented: true, exact: true },
          { label: "Revenue", href: "/finance/revenue", permission: "finance.revenue.view", implemented: true },
          { label: "Worker Payments", href: "/finance/worker-payments", permission: "finance.worker_payments.view", implemented: true },
          { label: "Expenses", href: "/finance/expenses", permission: "finance.expenses.view", implemented: true },
          { label: "Profit", href: "/finance/profit", permission: "finance.profit.view", implemented: true },
        ],
      },
      { label: "Create Invoice", href: "/invoices", icon: "invoice", permission: "finance.view", implemented: true },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        label: "Communication",
        href: "/communication",
        icon: "communication",
        permission: "communications.view",
        implemented: true,
        children: [
          // Email/WhatsApp compose tools stay unimplemented: sending either
          // needs a configured provider AND a queue to dispatch through
          // (specification Section 72), neither of which exists in this
          // project yet — the Redis/BullMQ decision was deferred this phase
          // (docs/NOTIFICATIONS.md). Templates and Message Logs need
          // neither, so they are real.
          { label: "Email", href: "/communication/email", permission: "email.send", implemented: false },
          { label: "WhatsApp", href: "/communication/whatsapp", permission: "whatsapp.send", implemented: false },
          { label: "Templates", href: "/communication/templates", permission: "templates.view", implemented: true },
          { label: "Message Logs", href: "/communication/message-logs", permission: "message_logs.view", implemented: true },
        ],
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: "reports",
        permission: "reports.view",
        implemented: true,
        children: [
          { label: "Sales", href: "/reports/sales", permission: "reports.sales", implemented: true },
          { label: "Orders", href: "/reports/orders", permission: "reports.orders", implemented: true },
          { label: "Workers", href: "/reports/workers", permission: "reports.workers", implemented: true },
          { label: "Customers", href: "/reports/customers", permission: "reports.customers", implemented: true },
          { label: "Profit", href: "/reports/profit", permission: "reports.profit", implemented: true },
        ],
      },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Users", href: "/settings/users", icon: "users", permission: "users.view", implemented: true },
      { label: "Roles", href: "/settings/roles", icon: "roles", permission: "roles.view", implemented: true },
      { label: "Permissions", href: "/settings/permissions", icon: "permissions", permission: "permissions.view", implemented: true },
      { label: "Settings", href: "/settings/system", icon: "settings", permission: "settings.view", implemented: true },
    ],
  },
];

export type NavigationFilterOptions = {
  /** Include nodes whose routes do not exist yet. Used by tests, not by the UI. */
  readonly includeUnimplemented?: boolean;
};

function filterNode(
  node: NavNode,
  permissions: EffectivePermissions,
  options: NavigationFilterOptions,
): NavNode | null {
  if (node.permission && !permissions.has(node.permission)) return null;

  const children = node.children
    ?.map((child) => filterNode(child, permissions, options))
    .filter((child): child is NavNode => child !== null);

  // A parent with declared children but none authorised/available is dropped
  // rather than left as a dead expandable row.
  if (node.children && (!children || children.length === 0)) return null;

  const available = options.includeUnimplemented === true || node.implemented;
  if (!available && (!children || children.length === 0)) return null;

  return children ? { ...node, children } : node;
}

/**
 * The navigation a specific actor should see.
 *
 * Sections with no visible items are removed entirely, so a Worker gets a short
 * sidebar rather than a long list of empty headings.
 */
export function getNavigationFor(
  permissions: EffectivePermissions,
  options: NavigationFilterOptions = {},
): NavSection[] {
  return NAVIGATION.map((section) => ({
    label: section.label,
    items: section.items
      .map((item) => filterNode(item, permissions, options))
      .filter((item): item is NavNode => item !== null),
  })).filter((section) => section.items.length > 0);
}

/** True when `pathname` should mark `node` as the active row. */
export function isNavNodeActive(node: NavNode, pathname: string): boolean {
  const path = node.href.split("?")[0];
  if (node.exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Which ONE child of a group is the current page, taking the query string into
 * account — `isNavNodeActive` ignores it on purpose (it decides whether a group
 * is open), which on its own would highlight every `/orders?status=…` shortcut
 * at once. A child matches when its path is active and every query param in its
 * href equals the current URL's; among matches the most specific one wins, so
 * `/orders?status=PENDING` beats the plain `/orders` "All Orders" link, and
 * "All Orders" only wins while no shortcut's params are present.
 */
export function currentNavChild(
  children: readonly NavNode[],
  pathname: string,
  search: URLSearchParams,
): NavNode | null {
  let best: NavNode | null = null;
  let bestScore = -1;
  for (const child of children) {
    const [path, query = ""] = child.href.split("?");
    const wanted = new URLSearchParams(query);
    const pathMatches = query ? pathname === path : isNavNodeActive(child, pathname);
    if (!pathMatches) continue;
    let matchesAll = true;
    let score = 0;
    for (const [key, value] of wanted) {
      if (search.get(key) !== value) matchesAll = false;
      else score += 1;
    }
    if (matchesAll && score > bestScore) {
      best = child;
      bestScore = score;
    }
  }
  return best;
}
