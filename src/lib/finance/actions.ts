"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import {
  createExpense,
  createExpenseCategory,
  createWorkerPayment,
  deleteWorkerPayment,
  setExpenseCategoryActive,
  setOrderRefunded,
  updateExpense,
  updateWorkerPayment,
} from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");
const moneyString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount.");
const currencyCode = z.string().trim().length(3).default("USD");
const dateOnly = z.iso.date("Enter a valid date.");

function toDate(dateOnlyString: string): Date {
  return new Date(`${dateOnlyString}T00:00:00.000Z`);
}

// ---------------------------------------------------------------------------
// Expense categories
// ---------------------------------------------------------------------------

export async function createExpenseCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ name: z.string().trim().min(1, "Name is required.").max(80) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("finance.expenses.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createExpenseCategory(auth.actor, parsed.data.name);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/finance/expenses");
  return { ok: true, message: "Category created." };
}

export async function setExpenseCategoryActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("finance.expenses.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setExpenseCategoryActive(auth.actor, parsed.data.id, parsed.data.isActive);
  if (result.ok) revalidatePath("/finance/expenses");
  return result.ok
    ? { ok: true, message: parsed.data.isActive ? "Category reactivated." : "Category deactivated." }
    : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

const expenseInputSchema = z.object({
  amount: moneyString,
  currency: currencyCode,
  categoryId: uuid,
  date: dateOnly,
  description: z.string().trim().max(2000).optional(),
  orderId: uuid.nullable().optional(),
  paidById: uuid.nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function createExpenseAction(input: unknown): Promise<ActionResult> {
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("finance.expenses.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createExpense(auth.actor, { ...parsed.data, date: toDate(parsed.data.date) });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/finance/expenses");
  revalidatePath("/finance");
  return { ok: true, message: "Expense recorded." };
}

const idSchema = z.object({ id: uuid });

export async function updateExpenseAction(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.extend(expenseInputSchema.shape).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("finance.expenses.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateExpense(auth.actor, parsed.data.id, { ...parsed.data, date: toDate(parsed.data.date) });
  if (result.ok) {
    revalidatePath("/finance/expenses");
    revalidatePath("/finance");
  }
  return result.ok ? { ok: true, message: "Expense updated." } : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Worker payments
// ---------------------------------------------------------------------------

const workerPaymentInputSchema = z.object({
  workerId: uuid.nullable().optional(),
  outsourcedWorkerId: uuid.nullable().optional(),
  amount: moneyString,
  currency: currencyCode,
  paymentDate: dateOnly,
  reference: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function createWorkerPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = workerPaymentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("finance.worker_payments.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createWorkerPayment(auth.actor, { ...parsed.data, paymentDate: toDate(parsed.data.paymentDate) });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/finance/worker-payments");
  revalidatePath("/finance");
  return { ok: true, message: "Payment recorded." };
}

export async function updateWorkerPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.extend(workerPaymentInputSchema.shape).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("finance.worker_payments.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateWorkerPayment(auth.actor, parsed.data.id, {
    ...parsed.data,
    paymentDate: toDate(parsed.data.paymentDate),
  });
  if (result.ok) {
    revalidatePath("/finance/worker-payments");
    revalidatePath("/finance");
  }
  return result.ok ? { ok: true, message: "Payment updated." } : { ok: false, error: result.error };
}

export async function deleteWorkerPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("finance.worker_payments.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await deleteWorkerPayment(auth.actor, parsed.data.id);
  if (result.ok) {
    revalidatePath("/finance/worker-payments");
    revalidatePath("/finance");
  }
  return result.ok ? { ok: true, message: "Payment deleted." } : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Order refund flag
// ---------------------------------------------------------------------------

export async function setOrderRefundedAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ orderId: uuid, refunded: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  // Marking a refund is a revenue-affecting financial correction, not a
  // workflow status change — gated on finance, not `orders.edit`.
  const auth = await authorizeAction("finance.revenue.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setOrderRefunded(auth.actor, parsed.data.orderId, parsed.data.refunded);
  if (result.ok) {
    revalidatePath(`/orders/${parsed.data.orderId}`);
    revalidatePath("/finance");
  }
  return result.ok
    ? { ok: true, message: parsed.data.refunded ? "Order marked as refunded." : "Refund flag cleared." }
    : { ok: false, error: result.error };
}
