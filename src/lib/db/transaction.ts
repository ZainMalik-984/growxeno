import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Shared shape for service-layer write operations, used across domains
 * (access control, CRM, and later phases).
 *
 * The convention: a service function runs its change inside a transaction and
 * throws `ServiceRejection` to roll it back with a message that is safe to
 * show the caller. `runTransaction` turns that into a `ServiceResult` so
 * callers never need their own try/catch.
 */

/** The transaction client passed into a callback — every model, no lifecycle methods. */
export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type ServiceResult<T = void> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

export const serviceFailure = (error: string): ServiceResult<never> => ({ ok: false, error });
export const serviceSuccess = <T>(data: T): ServiceResult<T> => ({ ok: true, data });

/** A business-rule rejection raised inside a transaction to roll it back. */
export class ServiceRejection extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceRejection";
  }
}

/**
 * Run `operation` in a transaction, turning a thrown `ServiceRejection` into a
 * clean `{ ok: false }` instead of an unhandled exception. Any other error
 * propagates — it is a bug, not a business-rule refusal, and should surface as
 * one.
 */
export async function runTransaction<T>(
  operation: (tx: TransactionClient) => Promise<T>,
): Promise<ServiceResult<T>> {
  try {
    const data = await prisma.$transaction(async (tx) => operation(tx as TransactionClient));
    return serviceSuccess(data);
  } catch (error) {
    if (error instanceof ServiceRejection) return serviceFailure(error.message);
    throw error;
  }
}
