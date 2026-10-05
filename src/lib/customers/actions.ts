"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import { searchCustomersByName, type CustomerSearchHit } from "./queries";
import { createCustomer, deleteCustomer, updateCustomer } from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };
export type CreateCustomerActionResult =
  | { ok: true; message: string; customerId: string }
  | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");

const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  email: z.email("Enter a valid email address.").optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export async function createCustomerAction(input: unknown): Promise<CreateCustomerActionResult> {
  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("customers.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createCustomer(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/customers");
  return { ok: true, message: "Customer created.", customerId: result.data.id };
}

const customerIdSchema = z.object({ customerId: uuid });

export async function updateCustomerAction(input: unknown): Promise<ActionResult> {
  const parsed = customerIdSchema.extend(customerInputSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("customers.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateCustomer(auth.actor, parsed.data.customerId, parsed.data);
  if (result.ok) {
    revalidatePath(`/customers/${parsed.data.customerId}`);
    revalidatePath("/customers");
  }
  return result.ok ? { ok: true, message: "Customer updated." } : { ok: false, error: result.error };
}

export async function deleteCustomerAction(input: unknown): Promise<ActionResult> {
  const parsed = customerIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("customers.delete");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await deleteCustomer(auth.actor, parsed.data.customerId);
  if (result.ok) revalidatePath("/customers");
  return result.ok ? { ok: true, message: "Customer deleted." } : { ok: false, error: result.error };
}

export type SearchCustomersActionResult = { ok: true; customers: CustomerSearchHit[] } | { ok: false; error: string };

/** Backs the order form's autocomplete. Read access is `customers.view`, same as the customer list page. */
export async function searchCustomersAction(input: unknown): Promise<SearchCustomersActionResult> {
  const parsed = z.object({ query: z.string().trim().max(160) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("customers.view");
  if (!auth.ok) return { ok: false, error: auth.message };

  const customers = await searchCustomersByName(parsed.data.query);
  return { ok: true, customers };
}
