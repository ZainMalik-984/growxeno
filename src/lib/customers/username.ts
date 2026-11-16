/** A customer's username: what was typed, or the name when left empty (owner request, 2026-11-15). */
export function customerUsername(name: string, username: string | null | undefined): string {
  return username?.trim() || name.trim();
}
