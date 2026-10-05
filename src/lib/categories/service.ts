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

/** Category write operations (specification Section 50). */

export type CategoryInput = { name: string; description?: string };

async function uniqueSlug(tx: TransactionClient, name: string): Promise<string> {
  const base = slugify(name) || "category";
  let candidate = base;
  let suffix = 2;
  while (await tx.category.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function createCategory(
  actor: Actor,
  input: CategoryInput,
): Promise<ServiceResult<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return failure("Give the category a name.");
  const description = input.description?.trim() || null;

  return runTransaction(async (tx) => {
    const clash = await tx.category.findUnique({ where: { name }, select: { id: true } });
    if (clash) throw new ServiceRejection(`A category named "${name}" already exists.`);

    const slug = await uniqueSlug(tx, name);
    const category = await tx.category.create({ data: { name, slug, description }, select: { id: true } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "category.created",
      entityType: "Category",
      entityId: category.id,
      summary: `Created category ${name}`,
      newValue: { name, description },
    });

    return { id: category.id };
  });
}

export async function updateCategory(
  actor: Actor,
  categoryId: string,
  input: CategoryInput,
): Promise<ServiceResult> {
  const name = input.name.trim();
  if (!name) return failure("Give the category a name.");
  const description = input.description?.trim() || null;

  return runTransaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: { name: true, description: true },
    });
    if (!category) throw new ServiceRejection("That category no longer exists.");

    if (name !== category.name) {
      const clash = await tx.category.findUnique({ where: { name }, select: { id: true } });
      if (clash) throw new ServiceRejection(`A category named "${name}" already exists.`);
    }

    await tx.category.update({ where: { id: categoryId }, data: { name, description } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "category.updated",
      entityType: "Category",
      entityId: categoryId,
      summary:
        name === category.name ? `Updated category ${name}` : `Renamed category ${category.name} to ${name}`,
      previousValue: { name: category.name, description: category.description },
      newValue: { name, description },
    });
  });
}

/** Refuses a category still holding any services (reassign or delete them first). */
export async function deleteCategory(actor: Actor, categoryId: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: { name: true, _count: { select: { services: true } } },
    });
    if (!category) throw new ServiceRejection("That category no longer exists.");
    if (category._count.services > 0) {
      throw new ServiceRejection(
        `${category.name} still has ${category._count.services} ` +
          `${category._count.services === 1 ? "service" : "services"}. Move or delete them first.`,
      );
    }

    await tx.category.delete({ where: { id: categoryId } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "category.deleted",
      entityType: "Category",
      entityId: categoryId,
      summary: `Deleted category ${category.name}`,
      previousValue: { name: category.name },
    });
  });
}
