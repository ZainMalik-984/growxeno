import "server-only";

import { redirect } from "next/navigation";

import { resolveScope, type AccessScope } from "@/lib/permissions/scope";
import { getCurrentActor, type Actor } from "./session";

/**
 * Authorization entry points.
 *
 * EVERY protected surface goes through one of these: Server Components, Server
 * Actions, Route Handlers, storage access, exports and background jobs.
 *
 * Navigation visibility is not authorization. Hiding a link in the sidebar
 * changes nothing about what a crafted request can reach, so the check has to
 * live here, next to the data.
 *
 * Two flavours, because pages and actions need different failure behaviour:
 *
 *   requirePermission()  for Server Components. Redirects (login / forbidden).
 *   authorizeAction()    for Server Actions and Route Handlers. Returns a
 *                        typed result so the caller can respond with a clean
 *                        error instead of throwing a redirect at a form POST.
 */

export class AuthorizationError extends Error {
  readonly permission: string;

  constructor(permission: string) {
    super(`Missing permission: ${permission}`);
    this.name = "AuthorizationError";
    this.permission = permission;
  }
}

/** Require a signed-in, active user. Redirects to /login otherwise. */
export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  // A deactivated profile resolves to zero permissions, but sending them to a
  // dead-looking application is worse than telling them plainly.
  if (!actor.user.isActive) redirect("/account-inactive");
  return actor;
}

/**
 * Require a specific permission in a Server Component.
 *
 * Redirects unauthenticated callers to /login and authorized-but-insufficient
 * callers to /forbidden.
 */
export async function requirePermission(permission: string): Promise<Actor> {
  const actor = await requireActor();
  if (!actor.permissions.has(permission)) {
    redirect(`/forbidden?permission=${encodeURIComponent(permission)}`);
  }
  return actor;
}

/** Require every listed permission. */
export async function requireAllPermissions(permissions: readonly string[]): Promise<Actor> {
  const actor = await requireActor();
  const missing = permissions.find((permission) => !actor.permissions.has(permission));
  if (missing) {
    redirect(`/forbidden?permission=${encodeURIComponent(missing)}`);
  }
  return actor;
}

/** Resolve the record scope for an action after confirming the actor holds it. */
export async function requireScope(
  permission: string,
): Promise<{ actor: Actor; scope: Exclude<AccessScope, "NONE"> }> {
  const actor = await requirePermission(permission);
  const scope = resolveScope(actor.permissions, permission);
  // requirePermission already rejected NONE; narrow the type for callers.
  return { actor, scope: scope === "NONE" ? "ASSIGNED" : scope };
}

export type AuthorizationResult =
  | { readonly ok: true; readonly actor: Actor }
  | { readonly ok: false; readonly reason: "UNAUTHENTICATED" | "INACTIVE" | "FORBIDDEN"; readonly message: string };

/**
 * Authorize a Server Action or Route Handler.
 *
 * Returns a result rather than redirecting. The message is safe to show a user:
 * it never reveals whether a particular record exists.
 */
export async function authorizeAction(permission: string): Promise<AuthorizationResult> {
  const actor = await getCurrentActor();

  if (!actor) {
    return {
      ok: false,
      reason: "UNAUTHENTICATED",
      message: "You are signed out. Sign in and try again.",
    };
  }

  if (!actor.user.isActive) {
    return {
      ok: false,
      reason: "INACTIVE",
      message: "This account is inactive. Contact an administrator.",
    };
  }

  if (!actor.permissions.has(permission)) {
    return {
      ok: false,
      reason: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    };
  }

  return { ok: true, actor };
}

/**
 * Authorize a Server Action that needs no specific permission — only a
 * signed-in, active user. For genuinely self-scoped actions only (marking
 * your OWN notification read, setting your OWN notification preference):
 * the action itself must still scope every write to `actor.user.id` and
 * never accept a target user id, or this becomes a privilege escalation.
 */
export async function authorizeAuthenticatedAction(): Promise<AuthorizationResult> {
  const actor = await getCurrentActor();

  if (!actor) {
    return { ok: false, reason: "UNAUTHENTICATED", message: "You are signed out. Sign in and try again." };
  }
  if (!actor.user.isActive) {
    return { ok: false, reason: "INACTIVE", message: "This account is inactive. Contact an administrator." };
  }

  return { ok: true, actor };
}
