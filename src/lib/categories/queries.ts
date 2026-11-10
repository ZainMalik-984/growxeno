import "server-only";

import { prisma } from "@/lib/db/prisma";
import { categoryImageUrl } from "./images";

/** Read queries for categories (specification Section 50). */

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Public URL of the category image, or null (2026-11-05). */
  imageUrl: string | null;
  isActive: boolean;
  serviceCount: number;
  /** Services currently active in it. */
  activeServiceCount: number;
};

export async function listCategories(): Promise<CategoryRow[]> {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imagePath: true,
      isActive: true,
      _count: { select: { services: true } },
      services: { where: { isActive: true }, select: { id: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: categoryImageUrl(category.imagePath),
    isActive: category.isActive,
    serviceCount: category._count.services,
    activeServiceCount: category.services.length,
  }));
}

/**
 * id/name only, in name order. Inactive categories are left out unless asked
 * for (2026-11-10): filters still need them to find older records.
 */
export async function listAssignableCategories(options: { includeInactive?: boolean } = {}): Promise<Array<{ id: string; name: string }>> {
  return prisma.category.findMany({
    where: options.includeInactive ? {} : { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
