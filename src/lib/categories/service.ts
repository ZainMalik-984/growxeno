import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import {
  runTransaction,
  ServiceRejection,
  serviceFailure as failure,
  type ServiceResult,
  type TransactionClient,
} from "@/lib/db/transaction";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/text/slug";
import { CATEGORY_IMAGE_BUCKET, CATEGORY_IMAGE_MAX_BYTES, sniffImage } from "./images";
import { optimizeCategoryImage } from "./optimize";

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
  let imagePath: string | null = null;
  const result = await runTransaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: { name: true, imagePath: true, _count: { select: { services: true } } },
    });
    if (!category) throw new ServiceRejection("That category no longer exists.");
    if (category._count.services > 0) {
      throw new ServiceRejection(
        `${category.name} still has ${category._count.services} ` +
          `${category._count.services === 1 ? "service" : "services"}. Move or delete them first.`,
      );
    }

    await tx.category.delete({ where: { id: categoryId } });
    imagePath = category.imagePath;

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
  // Its image goes too; a failure here only leaves an unused file behind.
  if (result.ok && imagePath) {
    try {
      await createSupabaseAdminClient().storage.from(CATEGORY_IMAGE_BUCKET).remove([imagePath]);
    } catch {
      // ignore
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Category image (2026-11-05) — Supabase Storage, bucket "category-images"
// ---------------------------------------------------------------------------

const STORAGE_NOT_READY =
  'Image storage isn\'t set up yet. In Supabase, create a public Storage bucket named "category-images" (see docs/ENVIRONMENT.md).';

/**
 * Uploads (or replaces) a category's image. The file is checked by its bytes
 * (PNG, JPEG or WebP, at most 8 MB), compressed to a WebP of at most 800×800,
 * stored under a fresh name, then the
 * category points at it and the previous file is removed. Upload happens
 * through the server with the secret key, so the bucket needs no upload policy.
 */
export async function setCategoryImage(actor: Actor, categoryId: string, file: File): Promise<ServiceResult<{ imagePath: string }>> {
  if (file.size === 0) return failure("Choose an image to upload.");
  if (file.size > CATEGORY_IMAGE_MAX_BYTES) return failure("That image is larger than 8 MB. Choose a smaller one.");

  const original = new Uint8Array(await file.arrayBuffer());
  if (!sniffImage(original)) return failure("Use a PNG, JPEG or WebP image.");
  // Resized, compressed to WebP and stripped of metadata before it is stored.
  const optimized = await optimizeCategoryImage(original);
  if (!optimized.ok) return failure(optimized.error);

  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true, imagePath: true } });
  if (!category) return failure("That category no longer exists.");

  let storage: ReturnType<SupabaseClient["storage"]["from"]>;
  try {
    storage = createSupabaseAdminClient().storage.from(CATEGORY_IMAGE_BUCKET);
  } catch {
    return failure("Supabase administrative access is not configured.");
  }

  const path = `${categoryId}/${randomUUID()}.webp`;
  const upload = await storage.upload(path, optimized.bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (upload.error) {
    return failure(/bucket not found/i.test(upload.error.message) ? STORAGE_NOT_READY : `Upload failed: ${upload.error.message}`);
  }

  const result = await runTransaction(async (tx) => {
    await tx.category.update({ where: { id: categoryId }, data: { imagePath: path } });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "category.image_updated",
      entityType: "Category",
      entityId: categoryId,
      summary: `${category.imagePath ? "Replaced" : "Added"} the image of category ${category.name}`,
      previousValue: { imagePath: category.imagePath },
      newValue: { imagePath: path, width: optimized.width, height: optimized.height, bytes: optimized.bytes.length, originalBytes: file.size },
    });
    return { imagePath: path };
  });

  if (!result.ok) {
    await storage.remove([path]).catch(() => {});
    return result;
  }
  if (category.imagePath) await storage.remove([category.imagePath]).catch(() => {});
  return result;
}

/** Removes a category's image (the file and the reference). */
export async function removeCategoryImage(actor: Actor, categoryId: string): Promise<ServiceResult> {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true, imagePath: true } });
  if (!category) return failure("That category no longer exists.");
  if (!category.imagePath) return { ok: true, data: undefined };

  const result = await runTransaction(async (tx) => {
    await tx.category.update({ where: { id: categoryId }, data: { imagePath: null } });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "category.image_removed",
      entityType: "Category",
      entityId: categoryId,
      summary: `Removed the image of category ${category.name}`,
      previousValue: { imagePath: category.imagePath },
    });
  });
  if (result.ok) {
    try {
      await createSupabaseAdminClient().storage.from(CATEGORY_IMAGE_BUCKET).remove([category.imagePath]);
    } catch {
      // The reference is gone; a leftover file is harmless.
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Active / inactive (2026-11-10, owner request)
// ---------------------------------------------------------------------------

/**
 * Deactivating a category deactivates every active service in it, marking
 * them `deactivatedByCategory`. Reactivating it brings back exactly those
 * services; ones that were already off stay off. One transaction, one audit row.
 */
export async function setCategoryActive(
  actor: Actor,
  categoryId: string,
  isActive: boolean,
): Promise<ServiceResult<{ servicesChanged: number }>> {
  return runTransaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id: categoryId }, select: { name: true, isActive: true } });
    if (!category) throw new ServiceRejection("That category no longer exists.");
    if (category.isActive === isActive) {
      throw new ServiceRejection(`${category.name} is already ${isActive ? "active" : "inactive"}.`);
    }

    await tx.category.update({ where: { id: categoryId }, data: { isActive } });
    const changed = isActive
      ? await tx.service.updateMany({
          where: { categoryId, isActive: false, deactivatedByCategory: true },
          data: { isActive: true, deactivatedByCategory: false },
        })
      : await tx.service.updateMany({
          where: { categoryId, isActive: true },
          data: { isActive: false, deactivatedByCategory: true },
        });

    const services = `${changed.count} ${changed.count === 1 ? "service" : "services"}`;
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: isActive ? "category.reactivated" : "category.deactivated",
      entityType: "Category",
      entityId: categoryId,
      summary: isActive
        ? `Reactivated category ${category.name} and ${services} switched off with it`
        : `Deactivated category ${category.name} and its ${services}`,
      previousValue: { isActive: category.isActive },
      newValue: { isActive, servicesChanged: changed.count },
    });
    return { servicesChanged: changed.count };
  });
}
