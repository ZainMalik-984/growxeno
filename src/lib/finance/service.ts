import "server-only";

import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import {
  runTransaction,
  ServiceRejection,
  serviceFailure as failure,
  type ServiceResult,
  type TransactionClient,
} from "@/lib/db/transaction";
import { slugify } from "@/lib/text/slug";

export type { ServiceResult };

/**
 * Finance write operations (specification Sections 48, 56-61).
 *
 * Corrections policy (docs/REQUIREMENTS.md D8, answered 2026-09-17): edit in
 * place, the audit log (written in the same transaction as every mutation
 * here) keeps the before/after history — there is no separate reversing-
 * entry mechanism. Expenses have no delete path (create/edit only, matching
 * the permission catalog's pre-existing `finance.expenses.*` shape, which
 * never included a delete key); Worker payments do (their catalog
 * permission is a single `.manage` key, covering create/edit/delete).
 *
 * Buyer payments (money received from a Buyer) existed here through Phase 7
 * and were removed entirely post-Phase-10 (2026-09-27, owner-directed) along
 * with Buyer itself — see `prisma/schema/crm.prisma`'s file header.
 */

// ---------------------------------------------------------------------------
// Expense categories
// ---------------------------------------------------------------------------

async function uniqueCategorySlug(tx: TransactionClient, name: string): Promise<string> {
  const base = slugify(name) || "category";
  let candidate = base;
  let suffix = 2;
  while (await tx.expenseCategory.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function createExpenseCategory(actor: Actor, name: string): Promise<ServiceResult<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return failure("Give the category a name.");

  return runTransaction(async (tx) => {
    const clash = await tx.expenseCategory.findUnique({ where: { name: trimmed }, select: { id: true } });
    if (clash) throw new ServiceRejection(`A category named "${trimmed}" already exists.`);

    const slug = await uniqueCategorySlug(tx, trimmed);
    const category = await tx.expenseCategory.create({ data: { name: trimmed, slug }, select: { id: true } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "expense_category.created",
      entityType: "ExpenseCategory",
      entityId: category.id,
      summary: `Created expense category ${trimmed}`,
      newValue: { name: trimmed },
    });

    return { id: category.id };
  });
}

export async function setExpenseCategoryActive(actor: Actor, id: string, isActive: boolean): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const category = await tx.expenseCategory.findUnique({ where: { id }, select: { name: true } });
    if (!category) throw new ServiceRejection("That category no longer exists.");

    await tx.expenseCategory.update({ where: { id }, data: { isActive } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: isActive ? "expense_category.reactivated" : "expense_category.deactivated",
      entityType: "ExpenseCategory",
      entityId: id,
      summary: `${isActive ? "Reactivated" : "Deactivated"} expense category ${category.name}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export type ExpenseInput = {
  amount: string;
  currency: string;
  categoryId: string;
  date: Date;
  description?: string;
  orderId?: string | null;
  paidById?: string | null;
  notes?: string;
};

export async function createExpense(actor: Actor, input: ExpenseInput): Promise<ServiceResult<{ id: string }>> {
  return runTransaction(async (tx) => {
    const category = await tx.expenseCategory.findUnique({ where: { id: input.categoryId }, select: { name: true } });
    if (!category) throw new ServiceRejection("That category no longer exists.");

    const expense = await tx.expense.create({
      data: {
        amount: input.amount,
        currency: input.currency,
        categoryId: input.categoryId,
        date: input.date,
        description: input.description?.trim() || null,
        orderId: input.orderId || null,
        paidById: input.paidById || null,
        notes: input.notes?.trim() || null,
        createdById: actor.user.id,
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "expense.created",
      entityType: "Expense",
      entityId: expense.id,
      summary: `Recorded a ${input.amount} ${input.currency} expense (${category.name})`,
      newValue: { ...input, date: input.date.toISOString().slice(0, 10) },
    });

    return { id: expense.id };
  });
}

export async function updateExpense(actor: Actor, id: string, input: ExpenseInput): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { id },
      select: { amount: true, currency: true, categoryId: true, date: true, orderId: true, paidById: true, description: true, notes: true },
    });
    if (!existing) throw new ServiceRejection("That expense no longer exists.");

    const category = await tx.expenseCategory.findUnique({ where: { id: input.categoryId }, select: { name: true } });
    if (!category) throw new ServiceRejection("That category no longer exists.");

    await tx.expense.update({
      where: { id },
      data: {
        amount: input.amount,
        currency: input.currency,
        categoryId: input.categoryId,
        date: input.date,
        description: input.description?.trim() || null,
        orderId: input.orderId || null,
        paidById: input.paidById || null,
        notes: input.notes?.trim() || null,
      },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "expense.updated",
      entityType: "Expense",
      entityId: id,
      summary: `Updated expense (${category.name})`,
      previousValue: { ...existing, amount: existing.amount.toString(), date: existing.date.toISOString().slice(0, 10) },
      newValue: { ...input, date: input.date.toISOString().slice(0, 10) },
    });
  });
}

// ---------------------------------------------------------------------------
// Worker payments
// ---------------------------------------------------------------------------

export type WorkerPaymentInput = {
  workerId?: string | null;
  outsourcedWorkerId?: string | null;
  amount: string;
  currency: string;
  paymentDate: Date;
  reference?: string;
  notes?: string;
};

function validateWorkerXor(input: { workerId?: string | null; outsourcedWorkerId?: string | null }): string | undefined {
  const workerId = input.workerId || null;
  const outsourcedWorkerId = input.outsourcedWorkerId || null;
  if (!workerId && !outsourcedWorkerId) return "Choose a worker to pay.";
  if (workerId && outsourcedWorkerId) return "A payment can go to an internal worker or an outsourced worker, not both.";
}

export async function createWorkerPayment(actor: Actor, input: WorkerPaymentInput): Promise<ServiceResult<{ id: string }>> {
  const problem = validateWorkerXor(input);
  if (problem) return failure(problem);

  return runTransaction(async (tx) => {
    const payment = await tx.workerPayment.create({
      data: {
        workerId: input.workerId || null,
        outsourcedWorkerId: input.outsourcedWorkerId || null,
        amount: input.amount,
        currency: input.currency,
        paymentDate: input.paymentDate,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        createdById: actor.user.id,
      },
      select: {
        id: true,
        worker: { select: { fullName: true } },
        outsourcedWorker: { select: { name: true } },
      },
    });

    const workerName = payment.worker?.fullName ?? payment.outsourcedWorker?.name ?? "a worker";
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "worker_payment.created",
      entityType: "WorkerPayment",
      entityId: payment.id,
      summary: `Paid ${workerName} ${input.amount} ${input.currency}`,
      newValue: { ...input, paymentDate: input.paymentDate.toISOString().slice(0, 10) },
    });

    return { id: payment.id };
  });
}

export async function updateWorkerPayment(actor: Actor, id: string, input: WorkerPaymentInput): Promise<ServiceResult> {
  const problem = validateWorkerXor(input);
  if (problem) return failure(problem);

  return runTransaction(async (tx) => {
    const existing = await tx.workerPayment.findUnique({
      where: { id },
      select: {
        amount: true,
        currency: true,
        paymentDate: true,
        reference: true,
        notes: true,
        worker: { select: { fullName: true } },
        outsourcedWorker: { select: { name: true } },
      },
    });
    if (!existing) throw new ServiceRejection("That payment no longer exists.");

    await tx.workerPayment.update({
      where: { id },
      data: {
        workerId: input.workerId || null,
        outsourcedWorkerId: input.outsourcedWorkerId || null,
        amount: input.amount,
        currency: input.currency,
        paymentDate: input.paymentDate,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    const workerName = existing.worker?.fullName ?? existing.outsourcedWorker?.name ?? "a worker";
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "worker_payment.updated",
      entityType: "WorkerPayment",
      entityId: id,
      summary: `Updated a payment to ${workerName}`,
      previousValue: { ...existing, amount: existing.amount.toString(), paymentDate: existing.paymentDate.toISOString().slice(0, 10) },
      newValue: { ...input, paymentDate: input.paymentDate.toISOString().slice(0, 10) },
    });
  });
}

export async function deleteWorkerPayment(actor: Actor, id: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.workerPayment.findUnique({
      where: { id },
      select: {
        amount: true,
        currency: true,
        worker: { select: { fullName: true } },
        outsourcedWorker: { select: { name: true } },
      },
    });
    if (!existing) throw new ServiceRejection("That payment no longer exists.");

    const workerName = existing.worker?.fullName ?? existing.outsourcedWorker?.name ?? "a worker";
    await tx.workerPayment.delete({ where: { id } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "worker_payment.deleted",
      entityType: "WorkerPayment",
      entityId: id,
      summary: `Deleted a ${existing.amount.toString()} ${existing.currency} payment to ${workerName}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Order-level: refund flag
// ---------------------------------------------------------------------------

/**
 * Whole-order, boolean, no partial refund (docs/REQUIREMENTS.md D4 follow-up,
 * answered 2026-09-17). The order keeps its real status; this just excludes
 * it from recognized revenue. Who/when is the audit log on this edit, same
 * as every other correction under D8's policy.
 */
export async function setOrderRefunded(actor: Actor, orderId: string, refunded: boolean): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, refunded: true } });
    if (!order) throw new ServiceRejection("That order no longer exists.");
    if (order.refunded === refunded) return;

    await tx.order.update({ where: { id: orderId }, data: { refunded } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: refunded ? "order.marked_refunded" : "order.unmarked_refunded",
      entityType: "Order",
      entityId: orderId,
      summary: `${actor.user.fullName} marked order #${order.orderNumber} as ${refunded ? "refunded" : "not refunded"}`,
      previousValue: { refunded: order.refunded },
      newValue: { refunded },
    });
  });
}
