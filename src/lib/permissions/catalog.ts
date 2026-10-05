/**
 * The permission catalog — the single source of truth for permission keys.
 *
 * This file is imported by:
 *   - prisma/seed.ts          to upsert the `permissions` table
 *   - src/lib/permissions/*   to type-check every `can()` / `requirePermission()` call
 *   - the role/user permission editors, to render the catalog grouped by module
 *
 * ADDING A PERMISSION
 * -------------------
 * 1. Add the entry below.
 * 2. Run `pnpm db:seed` (idempotent upsert — safe to re-run).
 * 3. Grant it to whichever roles need it.
 * The catalog is designed to grow; nothing is frozen. See docs/PERMISSIONS.md.
 *
 * The keys in the SPECIFIED CATALOG blocks are reproduced verbatim from
 * specification Section 8. Do not rename them. Keys marked "ADDED" are
 * documented additions and are listed in docs/PERMISSIONS.md with a rationale.
 */

export const PERMISSION_MODULES = [
  "orders",
  "customers",
  "workers",
  "daily_stats",
  "services",
  "categories",
  "finance",
  "reports",
  "communications",
  "users",
  "roles",
  "permissions",
  "settings",
  "audit",
  "fiverr_accounts",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export type PermissionDefinition = {
  readonly key: string;
  readonly name: string;
  readonly module: PermissionModule;
  readonly description: string;
  /**
   * Scope-widening keys are a separate axis from the action they widen.
   * Holding `orders.view` shows the actor their own/assigned records; holding
   * `orders.view.all` shows every record. See docs/PERMISSIONS.md §Scopes.
   */
  readonly widensScopeOf?: string;
};

export const PERMISSION_CATALOG = [
  // --- Orders (specification Section 8) -----------------------------------
  { key: "orders.view", name: "View orders", module: "orders", description: "See orders. Without orders.view.all this is limited to orders the user is assigned to." },
  { key: "orders.view.all", name: "View all orders", module: "orders", description: "ADDED (scope). See every order, not only assigned work.", widensScopeOf: "orders.view" },
  { key: "orders.create", name: "Create orders", module: "orders", description: "Create new orders and order items." },
  { key: "orders.edit", name: "Edit orders", module: "orders", description: "Edit order and order item details." },
  { key: "orders.delete", name: "Delete orders", module: "orders", description: "Delete an order." },
  { key: "orders.assign", name: "Assign orders", module: "orders", description: "Assign a worker to an order item." },
  { key: "orders.process", name: "Process orders", module: "orders", description: "Run Process Order: validate, activate items and notify." },
  { key: "orders.change_status", name: "Change order status", module: "orders", description: "Move an order or item through the workflow." },
  { key: "orders.comment", name: "Comment on orders", module: "orders", description: "Add internal notes to an order." },
  { key: "orders.files.view", name: "View order files", module: "orders", description: "List and download files attached to an order." },
  { key: "orders.files.upload", name: "Upload order files", module: "orders", description: "Attach files to an order or order item." },
  { key: "orders.activity.view", name: "View order activity", module: "orders", description: "See the activity history of an order." },
  { key: "orders.export", name: "Export orders", module: "orders", description: "Export order lists." },

  // Buyers (specification Section 8: buyers.view/create/edit/delete,
  // buyers.pricing.view/manage, buyers.payments.view/manage) was removed
  // entirely, post-Phase-10, 2026-09-27 — owner-directed, confirmed directly:
  // "Remove the Buyer category from order and from system." See
  // prisma/schema/crm.prisma's file header for the full record. This is a
  // deliberate, confirmed departure from the specification's literal Section
  // 8 catalog, the same kind of owner override already recorded for the
  // Order Item redesign (D12) and the OrderSource simplification below —
  // tests/unit/permission-catalog.test.ts's "every spec Section 8 key exists"
  // check was updated to match.

  // --- Customers (specification Section 8) --------------------------------
  { key: "customers.view", name: "View customers", module: "customers", description: "See customer records." },
  { key: "customers.create", name: "Create customers", module: "customers", description: "Create customer records." },
  { key: "customers.edit", name: "Edit customers", module: "customers", description: "Edit customer details." },
  { key: "customers.delete", name: "Delete customers", module: "customers", description: "Delete a customer." },

  // --- Workers (specification Section 8) ----------------------------------
  { key: "workers.view", name: "View workers", module: "workers", description: "See worker profiles — outsourced workers, and (scoped) internal worker profiles. Without workers.view.all, an internal worker profile is visible only to that worker themselves." },
  { key: "workers.view.all", name: "View all worker profiles", module: "workers", description: "ADDED (scope). See every internal worker's profile, not only your own.", widensScopeOf: "workers.view" },
  { key: "workers.create", name: "Create workers", module: "workers", description: "Create worker profiles." },
  { key: "workers.edit", name: "Edit workers", module: "workers", description: "Edit worker profiles." },
  { key: "workers.delete", name: "Delete workers", module: "workers", description: "Remove a worker profile." },
  { key: "workers.assign", name: "Assign work to workers", module: "workers", description: "Choose which worker performs an item." },
  { key: "workers.stats.view", name: "View worker statistics", module: "workers", description: "See performance figures. Without workers.stats.view.all this is limited to the user's own statistics." },
  { key: "workers.stats.view.all", name: "View all worker statistics", module: "workers", description: "ADDED (scope). See every worker's statistics.", widensScopeOf: "workers.stats.view" },
  { key: "workers.payments.view", name: "View worker payments", module: "workers", description: "See worker earnings and payments." },
  { key: "workers.payments.manage", name: "Manage worker payments", module: "workers", description: "Record worker payments." },

  // --- Daily statistics (specification Section 8) -------------------------
  { key: "daily_stats.view", name: "View daily statistics", module: "daily_stats", description: "See manually entered daily statistics. Without daily_stats.view.all this is limited to the user's own rows." },
  { key: "daily_stats.view.all", name: "View all daily statistics", module: "daily_stats", description: "ADDED (scope). See every user's daily statistics.", widensScopeOf: "daily_stats.view" },
  { key: "daily_stats.create", name: "Create daily statistics", module: "daily_stats", description: "Add daily statistics entries, including bulk entry." },
  { key: "daily_stats.edit", name: "Edit daily statistics", module: "daily_stats", description: "Edit existing daily statistics entries." },
  { key: "daily_stats.delete", name: "Delete daily statistics", module: "daily_stats", description: "Delete daily statistics entries." },
  { key: "daily_stats.export", name: "Export daily statistics", module: "daily_stats", description: "Export daily statistics." },

  // --- Services and categories (specification Section 8) ------------------
  { key: "services.view", name: "View services", module: "services", description: "See the service catalog." },
  { key: "services.create", name: "Create services", module: "services", description: "Add services." },
  { key: "services.edit", name: "Edit services", module: "services", description: "Edit services and service pricing." },
  { key: "services.delete", name: "Delete services", module: "services", description: "Remove services." },
  { key: "categories.view", name: "View categories", module: "categories", description: "See service categories." },
  { key: "categories.create", name: "Create categories", module: "categories", description: "Add service categories." },
  { key: "categories.edit", name: "Edit categories", module: "categories", description: "Edit service categories." },
  { key: "categories.delete", name: "Delete categories", module: "categories", description: "Remove service categories." },

  // --- Finance (specification Section 8) ----------------------------------
  { key: "finance.view", name: "Access finance", module: "finance", description: "Enter the finance area. Required alongside the specific finance permissions below." },
  { key: "finance.revenue.view", name: "View revenue", module: "finance", description: "See revenue figures." },
  { key: "finance.expenses.view", name: "View expenses", module: "finance", description: "See recorded expenses." },
  { key: "finance.expenses.create", name: "Create expenses", module: "finance", description: "Record expenses." },
  { key: "finance.expenses.edit", name: "Edit expenses", module: "finance", description: "Edit recorded expenses." },
  { key: "finance.profit.view", name: "View profit", module: "finance", description: "See profit calculations." },
  { key: "finance.revenue.manage", name: "Manage revenue", module: "finance", description: "ADDED. Financial corrections that affect recognized revenue — currently just the order refund flag. Replaces finance.buyer_payments.manage, removed with Buyer (2026-09-27)." },
  { key: "finance.worker_payments.view", name: "View worker payments (finance)", module: "finance", description: "See worker payments in the finance area." },
  { key: "finance.worker_payments.manage", name: "Manage worker payments (finance)", module: "finance", description: "Record worker payments in the finance area." },

  // --- Fiverr accounts and gigs (confirmed directly, 2026-09-27) ----------
  { key: "fiverr_accounts.view", name: "View Fiverr accounts", module: "fiverr_accounts", description: "See Fiverr accounts, their gigs, and gig stats/charts." },
  { key: "fiverr_accounts.manage", name: "Manage Fiverr accounts", module: "fiverr_accounts", description: "Create and edit Fiverr accounts and gigs, and enter daily gig stats." },
  { key: "fiverr_accounts.credentials.view", name: "View Fiverr PayPal credentials", module: "fiverr_accounts", description: "Reveal a Fiverr account's PayPal password. Separate from just seeing that the account exists." },

  // --- Reports (specification Section 8) ----------------------------------
  { key: "reports.view", name: "Access reports", module: "reports", description: "Enter the reports area." },
  { key: "reports.sales", name: "Sales reports", module: "reports", description: "View sales reports." },
  { key: "reports.orders", name: "Order reports", module: "reports", description: "View order reports." },
  { key: "reports.workers", name: "Worker reports", module: "reports", description: "View worker reports." },
  { key: "reports.customers", name: "Customer reports", module: "reports", description: "View customer reports." },
  { key: "reports.profit", name: "Profit reports", module: "reports", description: "View profit reports." },
  { key: "reports.export", name: "Export reports", module: "reports", description: "Export report output." },

  // --- Communications (specification Section 8) ---------------------------
  { key: "communications.view", name: "Access communications", module: "communications", description: "Enter the communication area." },
  { key: "email.send", name: "Send email", module: "communications", description: "Trigger outbound email." },
  { key: "whatsapp.send", name: "Send WhatsApp", module: "communications", description: "Trigger outbound WhatsApp messages." },
  { key: "templates.view", name: "View templates", module: "communications", description: "See message templates." },
  { key: "templates.manage", name: "Manage templates", module: "communications", description: "Create and edit message templates." },
  { key: "message_logs.view", name: "View message logs", module: "communications", description: "Inspect outbound message logs and failures." },

  // --- Users, roles, permissions, settings (specification Section 8) ------
  { key: "users.view", name: "View users", module: "users", description: "See application users." },
  { key: "users.create", name: "Create users", module: "users", description: "Create application users and send invitations." },
  { key: "users.edit", name: "Edit users", module: "users", description: "Edit user profiles, roles, direct permissions and activation." },
  { key: "users.delete", name: "Delete users", module: "users", description: "Remove a user record. Deactivation is preferred where history exists." },
  { key: "roles.view", name: "View roles", module: "roles", description: "See roles and their permissions." },
  { key: "roles.create", name: "Create roles", module: "roles", description: "Create and duplicate roles." },
  { key: "roles.edit", name: "Edit roles", module: "roles", description: "Rename roles and change their permissions." },
  { key: "roles.delete", name: "Delete roles", module: "roles", description: "Delete non-system roles." },
  { key: "permissions.view", name: "View permission catalog", module: "permissions", description: "Browse the permission catalog." },
  { key: "settings.view", name: "View settings", module: "settings", description: "See system settings." },
  { key: "settings.edit", name: "Edit settings", module: "settings", description: "Change system settings." },

  // --- Audit -------------------------------------------------------------
  { key: "audit.view", name: "View audit log", module: "audit", description: "ADDED. Read the cross-entity audit trail. Order-scoped history is covered by orders.activity.view." },
] as const satisfies readonly PermissionDefinition[];

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]["key"];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSION_CATALOG.map((p) => p.key);

const CATALOG_BY_KEY = new Map<string, PermissionDefinition>(
  PERMISSION_CATALOG.map((p) => [p.key, p]),
);

export function getPermissionDefinition(key: string): PermissionDefinition | undefined {
  return CATALOG_BY_KEY.get(key);
}

export function isKnownPermissionKey(key: string): key is PermissionKey {
  return CATALOG_BY_KEY.has(key);
}

/** Catalog grouped by module, in catalog order — used by the permission editors. */
export function permissionsByModule(): Array<{
  module: PermissionModule;
  permissions: PermissionDefinition[];
}> {
  return PERMISSION_MODULES.map((module) => ({
    module,
    permissions: PERMISSION_CATALOG.filter((p) => p.module === module),
  })).filter((group) => group.permissions.length > 0);
}
