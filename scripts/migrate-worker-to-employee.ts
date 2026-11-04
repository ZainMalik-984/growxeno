/**
 * One-off data migration (2026-10-08, owner-directed rename): "Worker" role
 * and the `workers.*` permission keys → "Employee" role, `employees.*` +
 * `outsourced_workers.*` keys.
 *
 * Must run in this exact order, against the LIVE database, before/after
 * `pnpm db:seed` as noted at each step — see the inline comments. This is
 * a one-time script, not meant to be re-run (it is not fully idempotent on
 * the DELETE step, though every other step is safe to repeat).
 *
 * Usage: tsx scripts/migrate-worker-to-employee.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Old key -> new key(s). `workers.assign` has no replacement (dead key —
// `orders.assign` was always the real gate for assignment).
const KEY_MAP: Record<string, string[]> = {
  "workers.view": ["employees.view"],
  "workers.view.all": ["employees.view.all", "outsourced_workers.view"],
  "workers.create": ["outsourced_workers.create"],
  "workers.edit": ["outsourced_workers.edit"],
  "workers.delete": ["outsourced_workers.delete"],
  "workers.stats.view": ["employees.stats.view"],
  "workers.stats.view.all": ["employees.stats.view.all"],
  "workers.payments.view": ["employees.payments.view"],
  "workers.payments.manage": ["employees.payments.manage"],
};

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Cannot migrate: neither DIRECT_URL nor DATABASE_URL is set.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    // Step 1: rename the role IN PLACE (same id), so every existing
    // user_roles row referencing it keeps working untouched.
    const renamed = await prisma.role.updateMany({
      where: { slug: "worker" },
      data: { name: "Employee", slug: "employee" },
    });
    console.log(`Step 1: renamed ${renamed.count} role row(s) worker -> employee.`);

    // Step 2 happens OUTSIDE this script: run `pnpm db:seed` now, before
    // continuing, so the new employees.*/outsourced_workers.* permission
    // rows exist (seedPermissions upserts the catalog; seedRoles will
    // correctly UPDATE the just-renamed Employee role by its new slug,
    // not create a duplicate, because the role id didn't change).
    const newKeys = Object.values(KEY_MAP).flat();
    const existingNewKeys = await prisma.permission.findMany({
      where: { key: { in: newKeys } },
      select: { key: true },
    });
    if (existingNewKeys.length < newKeys.length) {
      const missing = newKeys.filter((k) => !existingNewKeys.some((e) => e.key === k));
      throw new Error(
        `Missing new permission keys: ${missing.join(", ")}. Run 'pnpm db:seed' after Step 1 and before Step 3, then re-run this script.`,
      );
    }
    console.log(`Step 2: confirmed all ${newKeys.length} new permission keys exist (pnpm db:seed already ran).`);

    // Step 3: copy every grant on an old workers.* key onto its new
    // replacement key(s), for every role that holds it (not just the
    // seeded three) — ON CONFLICT DO NOTHING so this is safe to run even
    // if seed's own "grant ALL_PERMISSION_KEYS" already covered Super
    // Admin/Admin.
    const oldPerms = await prisma.permission.findMany({
      where: { key: { startsWith: "workers." } },
      select: { id: true, key: true },
    });
    const newPerms = await prisma.permission.findMany({
      where: { key: { in: newKeys } },
      select: { id: true, key: true },
    });
    const newPermIdByKey = new Map(newPerms.map((p) => [p.key, p.id]));

    let copied = 0;
    for (const oldPerm of oldPerms) {
      const replacements = KEY_MAP[oldPerm.key];
      if (!replacements) continue; // workers.assign — dropped, no replacement
      const grants = await prisma.rolePermission.findMany({
        where: { permissionId: oldPerm.id },
        select: { roleId: true },
      });
      for (const grant of grants) {
        for (const newKey of replacements) {
          const newPermId = newPermIdByKey.get(newKey);
          if (!newPermId) continue;
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: grant.roleId, permissionId: newPermId } },
            create: { roleId: grant.roleId, permissionId: newPermId },
            update: {},
          });
          copied += 1;
        }
      }
    }
    console.log(`Step 3: copied/confirmed ${copied} role_permission grant(s) onto new keys.`);

    // Step 4: delete the old workers.* permission rows. Cascades to
    // role_permissions automatically (onDelete: Cascade in the schema).
    const deleted = await prisma.permission.deleteMany({ where: { key: { startsWith: "workers." } } });
    console.log(`Step 4: deleted ${deleted.count} old workers.* permission row(s).`);

    console.log("\nMigration complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
