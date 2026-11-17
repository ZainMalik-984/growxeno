/**
 * One retry for reads that hit a dead database connection (2026-11-17).
 *
 * After a network drop (laptop sleep, Wi-Fi change, a pooler restart) the
 * connection pool can still hold sockets the other side already closed. The
 * first query on one fails with P1017 "Server has closed the connection" even
 * though the database is fine again, and because the session lookup runs on
 * every page, that one stale socket takes the whole page down. The failed
 * connection is discarded by the pool, so trying the same read once more on a
 * fresh one succeeds.
 *
 * Only reads are retried: a write whose connection dropped may or may not have
 * been applied, and repeating it could create a duplicate. Pure so it is
 * unit-tested; src/lib/db/prisma.ts applies it.
 */

/** Prisma model operations that only read. */
export const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** P1017: the server closed the connection. P1001: the server could not be reached (a socket dropped mid-connect). */
const CONNECTION_ERROR_CODES = new Set(["P1017", "P1001"]);

export function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && CONNECTION_ERROR_CODES.has(code);
}

/** Runs a read, and once more after a short pause if it failed on a dead connection. */
export async function withReadRetry<T>(operation: string, run: () => Promise<T>, pauseMs = 150): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!READ_OPERATIONS.has(operation) || !isConnectionError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
    return run();
  }
}
