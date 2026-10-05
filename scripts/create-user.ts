import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Create an application user from the command line.
 *
 * Phase 1 has no in-app user-creation screen yet, and an administrator still
 * needs a supported way to add people. This does exactly what that screen will
 * do, in the same order:
 *
 *   1. create the Supabase Auth identity (so the person can actually sign in)
 *   2. create the application profile linked to it
 *   3. assign a role
 *
 * It is deliberately NOT a way around authorization: it requires
 * SUPABASE_SECRET_KEY, which only someone with server access has.
 *
 * Usage:
 *   pnpm db:create-user --email a@b.com --name "Ada Lovelace" --role worker
 *   pnpm db:create-user --email a@b.com --name "Ada" --role worker --password "…"
 *
 * Roles are referenced by slug: super-admin, admin, worker.
 */

function generatePassword(): string {
  // 24 URL-safe characters. Printed once, then it is the user's to change.
  return randomBytes(18).toString("base64url");
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string" },
      password: { type: "string" },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const fullName = values.name?.trim();
  const roleSlug = values.role?.trim();

  if (!email || !fullName || !roleSlug) {
    console.error(
      'Usage: pnpm db:create-user --email <email> --name "<full name>" --role <role-slug> [--password <password>]',
    );
    process.exitCode = 1;
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !secretKey && "SUPABASE_SECRET_KEY",
    !connectionString && "DIRECT_URL or DATABASE_URL",
  ].filter(Boolean);

  if (missing.length > 0 || !supabaseUrl || !secretKey || !connectionString) {
    console.error(`Cannot create a user. Missing: ${missing.join(", ")}. See docs/ENVIRONMENT.md.`);
    process.exitCode = 1;
    return;
  }

  const password = values.password ?? generatePassword();
  const generated = !values.password;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const role = await prisma.role.findUnique({
      where: { slug: roleSlug },
      select: { id: true, name: true },
    });

    if (!role) {
      const available = await prisma.role.findMany({ select: { slug: true } });
      console.error(
        `No role with slug "${roleSlug}". Available: ${available.map((r) => r.slug).join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }

    // 1. Auth identity. Reuse an existing one rather than failing, so the
    //    script is safe to re-run after a partial failure.
    let authUserId: string | undefined;
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created.data.user) {
      authUserId = created.data.user.id;
    } else {
      const existing = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (existing.error) throw new Error(existing.error.message);
      const match = existing.data.users.find((user) => user.email?.toLowerCase() === email);
      if (!match) throw new Error(created.error?.message ?? "Could not create the auth identity.");
      authUserId = match.id;
      console.log("Auth identity already existed; reusing it (password unchanged).");
    }

    // 2 and 3. Profile and role assignment, in one transaction.
    const user = await prisma.$transaction(async (tx) => {
      const profile = await tx.user.upsert({
        where: { email },
        create: { email, fullName, authUserId, isActive: true },
        update: { authUserId, fullName, isActive: true },
        select: { id: true },
      });

      await tx.userRole.upsert({
        where: { userId_roleId: { userId: profile.id, roleId: role.id } },
        create: { userId: profile.id, roleId: role.id },
        update: {},
      });

      await tx.auditLog.create({
        data: {
          actorUserId: null,
          actorEmail: "cli:create-user",
          action: "user.created",
          entityType: "User",
          entityId: profile.id,
          summary: `Created ${fullName} (${email}) with role ${role.name} via the CLI`,
          newValue: { email, fullName, role: role.name },
        },
      });

      return profile;
    });

    console.log(`\nCreated ${fullName} <${email}>`);
    console.log(`  user id: ${user.id}`);
    console.log(`  role:    ${role.name}`);
    if (generated) {
      console.log(`  password: ${password}`);
      console.log("  ^ shown once. Give it to the user and have them change it.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Failed to create the user:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
