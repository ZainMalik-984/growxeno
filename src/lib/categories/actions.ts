"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import { createCategory, deleteCategory, updateCategory } from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");

const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(2000).optional(),
});

export type CreateCategoryActionResult =
  | { ok: true; message: string; categoryId: string }
  | { ok: false; error: string };

export async function createCategoryAction(input: unknown): Promise<CreateCategoryActionResult> {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("categories.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createCategory(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/categories");
  return { ok: true, message: "Category created.", categoryId: result.data.id };
}

const categoryIdSchema = z.object({ categoryId: uuid });

export async function updateCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = categoryIdSchema.extend(categoryInputSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("categories.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateCategory(auth.actor, parsed.data.categoryId, parsed.data);
  if (result.ok) revalidatePath("/categories");
  return result.ok ? { ok: true, message: "Category updated." } : { ok: false, error: result.error };
}

export async function deleteCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = categoryIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("categories.delete");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await deleteCategory(auth.actor, parsed.data.categoryId);
  if (result.ok) revalidatePath("/categories");
  return result.ok ? { ok: true, message: "Category deleted." } : { ok: false, error: result.error };
}
