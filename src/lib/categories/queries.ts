import "server-only";

import { prisma } from "@/lib/db/prisma";

/** Read queries for categories (specification Section 50). */

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  serviceCount: number;
};

export async function listCategories(): Promise<CategoryRow[]> {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { services: true } },
    },
    orderBy: { name: "asc" },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    serviceCount: category._count.services,
  }));
}

/** id/name only, in name order — for the picker on the Service form. */
export async function listAssignableCategories(): Promise<Array<{ id: string; name: string }>> {
  return prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
