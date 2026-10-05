import path from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Next.js loads `.env.local` automatically; the Prisma CLI does not. Load the
 * same files here, in Next.js precedence order — dotenv does not overwrite a
 * variable that is already set, so the first file listed wins.
 */
loadEnv({ path: [".env.local", ".env"], quiet: true });

/**
 * Prisma CLI configuration (required by Prisma ORM 7).
 *
 * Two connection strings exist and they are NOT interchangeable:
 *
 *   DIRECT_URL   direct / session-pooler connection. Used HERE, because the
 *                Prisma CLI runs migrations, which need a real session and
 *                cannot run through a transaction pooler.
 *
 *   DATABASE_URL the connection the running application uses, normally the
 *                transaction pooler. Consumed by the driver adapter in
 *                src/lib/db/prisma.ts, not by this file.
 *
 * DIRECT_URL falls back to DATABASE_URL for simple local setups where both are
 * the same server. See docs/ENVIRONMENT.md.
 */
export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
