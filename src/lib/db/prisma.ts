import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseEnv } from "@/lib/env";

/**
 * The Prisma client singleton.
 *
 * IMPORTANT SECURITY NOTE
 * -----------------------
 * This connection uses the credentials in DATABASE_URL. That database role is
 * the table owner and is therefore NOT subject to Row Level Security. Prisma
 * does not, and cannot, inherit the signed-in user's Supabase JWT.
 *
 * Consequently every read and write made through this client is unrestricted at
 * the database level, and authorization MUST be enforced in server code before
 * reaching it. See src/lib/auth/authorize.ts and docs/PERMISSIONS.md.
 *
 * Prisma ORM 7 requires a driver adapter; PrismaPg wraps node-postgres.
 *
 * CONSTRUCTION IS LAZY. The client is built on first property access, not at
 * module import, so that `next build` and unit tests succeed on a machine with
 * no database configured. Code that actually touches the database fails with a
 * ConfigurationError at that moment, which is the correct fail-closed behavior.
 */

const globalForPrisma = globalThis as unknown as {
  prismaClient: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getDatabaseEnv();

  const adapter = new PrismaPg({
    connectionString: DATABASE_URL,
    /**
     * WHY THIS IS HERE (diagnosed 2026-09-28: every page navigation felt like
     * 2-5 seconds, not instant).
     *
     * node-postgres's own default is `idleTimeoutMillis: 10_000` — any client
     * sitting unused in the pool for 10s is closed and discarded. A person
     * reading one page before clicking the next link routinely takes longer
     * than that, so the pool was closing its only warm connection between
     * almost every navigation. The next request then paid a full new
     * TCP+TLS+auth handshake to the pooler before it could even run the
     * query — measured against this project (region `ap-northeast-2`) at
     * roughly 650-1400ms on its own, on top of the ~150ms a single round
     * trip already costs from a distant client.
     *
     * The first fix tried here was `idleTimeoutMillis: 0` (never recycle).
     * That was wrong and caused a real regression the same day: Supabase's
     * transaction pooler (Supavisor) can close a connection's socket on ITS
     * side after its own idle window, silently — no RST the client sees
     * immediately. With recycling disabled, our pool kept handing out that
     * now-dead connection, and the next query on it didn't fail fast, it
     * hung — surfacing as `getCurrentActor()`'s `prisma.user.findUnique()`
     * timing out inside the root layout, which every single page depends on,
     * so the whole app looked broken. A finite (if generous) timeout means
     * OUR side periodically recycles a connection before it can go stale
     * that way — bounding the problem instead of removing the safety net
     * that catches it. `keepAlive` sends TCP keepalive probes so a
     * connection is not ALSO silently dropped by a NAT/LB in between.
     * `query_timeout` is the other half: if a connection still goes bad
     * between recycles, a query on it fails within 15s with a clear
     * "canceling statement due to statement timeout" error rather than
     * hanging indefinitely and taking the page down with it.
     */
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    query_timeout: 15_000,
  });

  return new PrismaClient({
    adapter,
    /**
     * Prisma's default `maxWait` for acquiring a connection to begin an
     * interactive transaction is 2000 ms. That is measured from the start of
     * the transaction, and on a cold connection it has to cover the TCP and TLS
     * handshake to the database region as well.
     *
     * Measured against this project (region ap-northeast-2, client elsewhere):
     * `$connect()` returns in ~56 ms but the first real query takes ~2019 ms,
     * so the default fails the FIRST write of every cold process with
     * "Unable to start a transaction in the given time" while every read
     * succeeds — a partial failure that is easy to misdiagnose. On serverless
     * that is every cold invocation.
     *
     * These values are generous enough for a distant region and still bounded,
     * so a genuinely stuck transaction fails rather than hanging.
     */
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
    log:
      process.env.NODE_ENV === "development"
        ? [{ emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }]
        : [{ emit: "stdout", level: "error" }],
  });
}

/** Returns the singleton, creating it on first call. Throws if unconfigured. */
export function getPrisma(): PrismaClient {
  // Reused across hot reloads in development so we do not exhaust the
  // connection pool with a new client per module evaluation.
  const existing = globalForPrisma.prismaClient;
  if (existing) return existing;

  const client = createPrismaClient();
  globalForPrisma.prismaClient = client;
  return client;
}

/**
 * Ergonomic accessor: `prisma.user.findMany(...)` works, but the underlying
 * client is only constructed when a property is first read.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getPrisma() as object, property, receiver);
  },
  has(_target, property) {
    return Reflect.has(getPrisma() as object, property);
  },
});
