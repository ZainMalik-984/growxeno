/**
 * "TikTok · Views": a service named with its category, for lists that show the
 * service on its own (owner request, 2026-11-10 — services are named "Views",
 * "Likes", … in every platform, so the name alone is ambiguous). Skips the
 * prefix when the service name already mentions its category. Pure.
 */
export function serviceLabel(serviceName: string, categoryName: string | null | undefined): string {
  const category = categoryName?.trim();
  if (!category) return serviceName;
  // Whole words only: the category "X" must not match the x in "Max views".
  const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentions = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu");
  if (mentions.test(serviceName)) return serviceName;
  return `${category} · ${serviceName}`;
}
