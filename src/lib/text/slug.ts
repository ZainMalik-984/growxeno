/**
 * Turn a name (a role, a pricing tier, ...) into a URL/DB-safe slug.
 *
 * Pure and side-effect free so it is unit-testable without a database.
 * Uniqueness (appending `-2`, `-3`, ...) is the caller's job, since that
 * requires checking existing rows.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
