import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
  PERMISSION_MODULES,
  isKnownPermissionKey,
  permissionsByModule,
  type PermissionDefinition,
} from "@/lib/permissions/catalog";

describe("permission catalog", () => {
  it("has no duplicate keys", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
  });

  it("contains every key listed in specification Section 8 that the owner has not directed removed", () => {
    // Transcribed from the specification. If a key is ever dropped from the
    // catalog by accident, this fails rather than silently removing access.
    //
    // Buyer's keys (buyers.view/create/edit/delete, buyers.pricing.view/manage,
    // buyers.payments.view/manage) and the buyer-specific reports.buyers and
    // finance.buyer_payments.view/manage were REMOVED from this list,
    // post-Phase-10 (2026-09-27) — owner-directed, confirmed directly: "Remove
    // the Buyer category from order and from system." See
    // prisma/schema/crm.prisma's file header for the full record. This is a
    // deliberate departure from literal Section 8 conformance, not a bug.
    const specified = [
      "orders.view", "orders.create", "orders.edit", "orders.delete", "orders.assign",
      "orders.process", "orders.change_status", "orders.comment", "orders.files.view",
      "orders.files.upload", "orders.activity.view", "orders.export",
      "customers.view", "customers.create", "customers.edit", "customers.delete",
      "workers.view", "workers.create", "workers.edit", "workers.delete", "workers.assign",
      "workers.stats.view", "workers.payments.view", "workers.payments.manage",
      "daily_stats.view", "daily_stats.create", "daily_stats.edit", "daily_stats.delete",
      "daily_stats.export",
      "services.view", "services.create", "services.edit", "services.delete",
      "categories.view", "categories.create", "categories.edit", "categories.delete",
      "finance.view", "finance.revenue.view", "finance.expenses.view", "finance.expenses.create",
      "finance.expenses.edit", "finance.profit.view", "finance.worker_payments.view",
      "finance.worker_payments.manage",
      "reports.view", "reports.sales", "reports.orders", "reports.workers",
      "reports.customers", "reports.profit", "reports.export",
      "communications.view", "email.send", "whatsapp.send", "templates.view", "templates.manage",
      "message_logs.view",
      "users.view", "users.create", "users.edit", "users.delete",
      "roles.view", "roles.create", "roles.edit", "roles.delete",
      "permissions.view", "settings.view", "settings.edit",
    ];

    const missing = specified.filter((key) => !isKnownPermissionKey(key));
    expect(missing).toEqual([]);
  });

  it("uses a declared module for every permission", () => {
    const invalid = PERMISSION_CATALOG.filter(
      (permission) => !PERMISSION_MODULES.includes(permission.module),
    );
    expect(invalid).toEqual([]);
  });

  it("groups every permission into exactly one module bucket", () => {
    const grouped = permissionsByModule().flatMap((group) => group.permissions);
    expect(grouped).toHaveLength(PERMISSION_CATALOG.length);
  });

  it("declares each scope key against a real action key", () => {
    // `as const satisfies` narrows each entry to its own literal type, which
    // drops the optional field from most members. Widen to the declared shape.
    const catalog: readonly PermissionDefinition[] = PERMISSION_CATALOG;

    for (const permission of catalog) {
      if (!permission.widensScopeOf) continue;
      expect(isKnownPermissionKey(permission.widensScopeOf)).toBe(true);
      expect(permission.key).toBe(`${permission.widensScopeOf}.all`);
    }
  });
});

describe("no hard-coded role checks", () => {
  it("the codebase never branches on a role name", () => {
    // Specification Section 5: authorization must not contain
    // `if (user.role === "admin")`. This asserts the invariant mechanically so
    // it cannot rot.
    const files = [
      "src/lib/permissions/resolve.ts",
      "src/lib/permissions/scope.ts",
      "src/lib/auth/authorize.ts",
      "src/lib/auth/session.ts",
      "src/lib/access/service.ts",
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      // Strip comments before checking — the docs legitimately mention the names.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

      expect(code, `${file} references a role name`).not.toMatch(
        /["'](super[-_ ]?admin|admin|worker)["']/i,
      );
    }
  });
});
