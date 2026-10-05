import { config as loadEnv } from "dotenv";

// Next.js loads `.env.local` automatically; a plain tsx script does not.
// Same precedence order — the first file listed wins.
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSION_CATALOG } from "../src/lib/permissions/catalog";
import { slugify } from "../src/lib/text/slug";

/**
 * Database seed.
 *
 * Idempotent: every write is an upsert, so running it repeatedly is safe and is
 * in fact the supported way to sync the permission catalog after adding a key.
 *
 * It does three things:
 *   1. upserts the permission catalog from src/lib/permissions/catalog.ts;
 *   2. upserts the three starting roles and their permission sets;
 *   3. optionally provisions the first Super Admin, if the credentials to do so
 *      are present.
 *
 * Step 3 is skipped — loudly, not silently — when SUPABASE_SECRET_KEY,
 * SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD are missing. It cannot be faked: an
 * application user without a Supabase Auth identity cannot sign in.
 *
 * Note: this file deliberately does NOT import src/lib/db/prisma.ts, which is
 * marked `server-only` and would refuse to load outside Next.js.
 */

const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((permission) => permission.key);

/**
 * Everything except the most dangerous access-control and configuration
 * actions. An Admin runs the business; changing the shape of the permission
 * system itself stays with Super Admin.
 */
const ADMIN_EXCLUDED = new Set([
  "users.delete",
  "roles.create",
  "roles.edit",
  "roles.delete",
  "settings.edit",
]);

/**
 * A Worker sees their own assigned work and nothing financial.
 *
 * Note what is absent: `orders.view.all`. The Worker holds `orders.view`, which
 * resolves to the ASSIGNED scope — the difference between "can open the orders
 * page" and "can read every order in the business".
 */
const WORKER_PERMISSIONS = [
  "orders.view",
  "orders.comment",
  "orders.change_status",
  "orders.files.view",
  "orders.files.upload",
  "orders.activity.view",
  "daily_stats.view",
  "workers.view",
  "workers.stats.view",
];

type RoleSeed = {
  name: string;
  slug: string;
  description: string;
  permissionKeys: string[];
};

const ROLES: RoleSeed[] = [
  {
    name: "Super Admin",
    slug: "super-admin",
    description:
      "Full access, including the permission system itself. An ordinary role that happens to hold every permission — the code never checks for this name.",
    permissionKeys: ALL_PERMISSION_KEYS,
  },
  {
    name: "Admin",
    slug: "admin",
    description:
      "Runs day-to-day operations, CRM and finance. Cannot restructure roles or delete users.",
    permissionKeys: ALL_PERMISSION_KEYS.filter((key) => !ADMIN_EXCLUDED.has(key)),
  },
  {
    name: "Worker",
    slug: "worker",
    description:
      "Performs assigned work. Sees only their own assignments and has no financial access.",
    permissionKeys: WORKER_PERMISSIONS,
  },
];

/** Specification Section 60's example categories — a starting point, not a fixed list. */
const EXPENSE_CATEGORIES = ["Software", "Advertising", "Infrastructure", "Salaries", "Office", "Miscellaneous"];

function createPrisma(): PrismaClient {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Cannot seed: neither DIRECT_URL nor DATABASE_URL is set. See docs/ENVIRONMENT.md.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function seedPermissions(prisma: PrismaClient): Promise<Map<string, string>> {
  for (const definition of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        name: definition.name,
        module: definition.module,
        description: definition.description,
      },
      update: {
        name: definition.name,
        module: definition.module,
        description: definition.description,
      },
    });
  }

  const stored = await prisma.permission.findMany({ select: { id: true, key: true } });
  console.log(`  permissions: ${stored.length} in database (${PERMISSION_CATALOG.length} in catalog)`);
  return new Map(stored.map((permission) => [permission.key, permission.id]));
}

async function seedRoles(prisma: PrismaClient, permissionIds: Map<string, string>): Promise<void> {
  for (const roleSeed of ROLES) {
    const role = await prisma.role.upsert({
      where: { slug: roleSeed.slug },
      create: {
        name: roleSeed.name,
        slug: roleSeed.slug,
        description: roleSeed.description,
        isSystem: true,
      },
      // Name and description are refreshed; isSystem is not downgraded.
      update: { name: roleSeed.name, description: roleSeed.description, isSystem: true },
      select: { id: true, name: true },
    });

    // Grant the seeded set. Existing extra grants added by an administrator are
    // left alone: the seed establishes a baseline, it does not police the role.
    for (const key of roleSeed.permissionKeys) {
      const permissionId = permissionIds.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }

    console.log(`  role ${role.name}: ${roleSeed.permissionKeys.length} permissions granted`);
  }
}

async function seedExpenseCategories(prisma: PrismaClient): Promise<void> {
  for (const name of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name },
      create: { name, slug: slugify(name) },
      update: {},
    });
  }
  console.log(`  expense categories: ${EXPENSE_CATEGORIES.length} seeded (idempotent)`);
}

async function seedSuperAdminUser(prisma: PrismaClient): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME?.trim() || "Super Admin";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  const missing: string[] = [];
  if (!email) missing.push("SEED_ADMIN_EMAIL");
  if (!password) missing.push("SEED_ADMIN_PASSWORD");
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!secretKey) missing.push("SUPABASE_SECRET_KEY");

  if (missing.length > 0 || !email || !password || !supabaseUrl || !secretKey) {
    console.log(
      `\n  SKIPPED: no Super Admin user was created.\n` +
        `  Missing: ${missing.join(", ")}\n` +
        `  Roles and permissions are seeded, but nobody can sign in yet.\n` +
        `  Set those variables and re-run 'pnpm db:seed'. See docs/DEVELOPMENT.md.`,
    );
    return;
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find an existing auth identity before creating one, so re-running the seed
  // does not fail on a duplicate.
  let authUserId: string | undefined;

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (created.data.user) {
    authUserId = created.data.user.id;
    console.log(`  created Supabase Auth identity for ${email}`);
  } else {
    // Most likely: the identity already exists. Look it up rather than guessing.
    const existing = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (existing.error) {
      console.log(`  FAILED to provision auth identity: ${existing.error.message}`);
      return;
    }
    const match = existing.data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );
    if (!match) {
      console.log(
        `  FAILED to provision auth identity: ${created.error?.message ?? "unknown error"}`,
      );
      return;
    }
    authUserId = match.id;
    console.log(`  reusing existing Supabase Auth identity for ${email}`);
  }

  const superAdmin = await prisma.role.findUnique({
    where: { slug: "super-admin" },
    select: { id: true },
  });
  if (!superAdmin) {
    console.log("  FAILED: the super-admin role is missing.");
    return;
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, fullName, authUserId, isActive: true },
    update: { authUserId, isActive: true },
    select: { id: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdmin.id } },
    create: { userId: user.id, roleId: superAdmin.id },
    update: {},
  });

  console.log(`  Super Admin ready: ${email}`);
}

async function main(): Promise<void> {
  const prisma = createPrisma();

  try {
    console.log("Seeding access control…");
    const permissionIds = await seedPermissions(prisma);
    await seedRoles(prisma, permissionIds);

    console.log("Seeding finance…");
    await seedExpenseCategories(prisma);

    // Last, and non-fatal: this step alone depends on the Supabase Admin API
    // (needs Node 22's native WebSocket — see docs/DEVELOPMENT.md), so a
    // failure here must not roll back or skip the independent seed steps
    // above, which have already committed.
    try {
      await seedSuperAdminUser(prisma);
    } catch (error) {
      console.error("\n  Super Admin provisioning failed (see error below) — other seed steps still completed.");
      console.error(error);
    }

    console.log("\nSeed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
