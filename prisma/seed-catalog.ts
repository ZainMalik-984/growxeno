import type { PrismaClient, ServiceMetricType } from "../src/generated/prisma/client";

/**
 * Default social-media catalog (owner request, 2026-11-10): YouTube, TikTok,
 * X, Instagram and Facebook, each with Subscribers/Followers, Views, Likes and
 * Comments, plus Watch Hours on YouTube only.
 *
 * Idempotent and non-destructive: a category is matched by slug and a service
 * by metric type within its category, so running it again (or against a
 * database that already has some of these, e.g. a "Youtube" category with a
 * "Subscribers" service) only adds what is missing. Existing names, prices
 * and active states are never changed.
 */

type DefaultCategory = { slug: string; name: string; services: Array<{ name: string; metric: ServiceMetricType }> };

const social = (follow: { name: string; metric: ServiceMetricType }) => [
  follow,
  { name: "Views", metric: "VIEWS" as const },
  { name: "Likes", metric: "LIKES" as const },
  { name: "Comments", metric: "COMMENTS" as const },
];

export const DEFAULT_CATALOG: DefaultCategory[] = [
  {
    slug: "youtube",
    name: "YouTube",
    services: [
      { name: "Subscribers", metric: "SUBSCRIBERS" },
      { name: "Views", metric: "VIEWS" },
      { name: "Watch Hours", metric: "WATCH_HOURS" },
      { name: "Likes", metric: "LIKES" },
      { name: "Comments", metric: "COMMENTS" },
    ],
  },
  { slug: "tiktok", name: "TikTok", services: social({ name: "Followers", metric: "FOLLOWERS" }) },
  { slug: "x", name: "X", services: social({ name: "Followers", metric: "FOLLOWERS" }) },
  { slug: "instagram", name: "Instagram", services: social({ name: "Followers", metric: "FOLLOWERS" }) },
  { slug: "facebook", name: "Facebook", services: social({ name: "Followers", metric: "FOLLOWERS" }) },
];

export async function seedDefaultCatalog(prisma: PrismaClient): Promise<{ categoriesAdded: number; servicesAdded: number }> {
  let categoriesAdded = 0;
  let servicesAdded = 0;
  for (const def of DEFAULT_CATALOG) {
    let category = await prisma.category.findUnique({ where: { slug: def.slug }, select: { id: true, isActive: true } });
    if (!category) {
      // A same-named category with a different slug counts as the same one.
      category = await prisma.category.findFirst({
        where: { name: { equals: def.name, mode: "insensitive" } },
        select: { id: true, isActive: true },
      });
    }
    if (!category) {
      category = await prisma.category.create({ data: { slug: def.slug, name: def.name }, select: { id: true, isActive: true } });
      categoriesAdded += 1;
    }
    const existing = await prisma.service.findMany({ where: { categoryId: category.id }, select: { metricType: true } });
    const have = new Set(existing.map((s) => s.metricType));
    for (const svc of def.services) {
      if (have.has(svc.metric)) continue;
      await prisma.service.create({
        data: {
          name: svc.name,
          categoryId: category.id,
          metricType: svc.metric,
          // Follows its category: added switched off if the category is off.
          isActive: category.isActive,
          deactivatedByCategory: !category.isActive,
        },
      });
      servicesAdded += 1;
    }
  }
  return { categoriesAdded, servicesAdded };
}
