"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import {
  assignRoleToUser,
  clearDirectPermission,
  createRole,
  createUser,
  deleteRole,
  duplicateRole,
  removeRoleFromUser,
  setDirectPermission,
  setRolePermission,
  setUserActive,
  updateRole,
  type ServiceResult,
} from "./service";

/**
 * Server Actions for access control.
 *
 * The shape of every one of these is the same on purpose:
 *
 *   1. validate the input with Zod (never trust a form field);
 *   2. authorize against the resolved permission set (never trust a submitted
 *      user id or a hidden "isAdmin" field);
 *   3. call the service, which owns the business rules and the audit row;
 *   4. revalidate the affected paths.
 *
 * Note that step 2 does NOT rely on the request having passed through the
 * proxy. A Server Action is a POST to the page route, and Next.js explicitly
 * warns that matcher changes can remove proxy coverage, so the check lives here.
 */

const uuid = z.uuid("Invalid identifier.");

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

function toActionResult(result: ServiceResult<unknown>, successMessage: string): ActionResult {
  return result.ok ? { ok: true, message: successMessage } : { ok: false, error: result.error };
}

const assignRoleSchema = z.object({ userId: uuid, roleId: uuid });

export async function assignRoleAction(input: unknown): Promise<ActionResult> {
  const parsed = assignRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("users.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await assignRoleToUser(auth.actor, parsed.data.userId, parsed.data.roleId);
  if (result.ok) revalidatePath(`/settings/users/${parsed.data.userId}`);
  return toActionResult(result, "Role assigned.");
}

export async function removeRoleAction(input: unknown): Promise<ActionResult> {
  const parsed = assignRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("users.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await removeRoleFromUser(auth.actor, parsed.data.userId, parsed.data.roleId);
  if (result.ok) revalidatePath(`/settings/users/${parsed.data.userId}`);
  return toActionResult(result, "Role removed.");
}

const overrideSchema = z.object({
  userId: uuid,
  permissionKey: z.string().min(1).max(120),
  effect: z.enum(["ALLOW", "DENY"]),
  reason: z.string().max(500).optional(),
});

export async function setDirectPermissionAction(input: unknown): Promise<ActionResult> {
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("users.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setDirectPermission(
    auth.actor,
    parsed.data.userId,
    parsed.data.permissionKey,
    parsed.data.effect,
    parsed.data.reason,
  );
  if (result.ok) revalidatePath(`/settings/users/${parsed.data.userId}`);
  return toActionResult(result, `Direct ${parsed.data.effect} applied.`);
}

const clearOverrideSchema = z.object({
  userId: uuid,
  permissionKey: z.string().min(1).max(120),
});

export async function clearDirectPermissionAction(input: unknown): Promise<ActionResult> {
  const parsed = clearOverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("users.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await clearDirectPermission(
    auth.actor,
    parsed.data.userId,
    parsed.data.permissionKey,
  );
  if (result.ok) revalidatePath(`/settings/users/${parsed.data.userId}`);
  return toActionResult(result, "Override removed.");
}

const rolePermissionSchema = z.object({
  roleId: uuid,
  permissionKey: z.string().min(1).max(120),
  granted: z.boolean(),
});

export async function setRolePermissionAction(input: unknown): Promise<ActionResult> {
  const parsed = rolePermissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("roles.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setRolePermission(
    auth.actor,
    parsed.data.roleId,
    parsed.data.permissionKey,
    parsed.data.granted,
  );
  if (result.ok) {
    revalidatePath(`/settings/roles/${parsed.data.roleId}`);
    revalidatePath("/settings/roles");
  }
  return toActionResult(result, parsed.data.granted ? "Permission granted." : "Permission revoked.");
}

const setActiveSchema = z.object({ userId: uuid, isActive: z.boolean() });

export async function setUserActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("users.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setUserActive(auth.actor, parsed.data.userId, parsed.data.isActive);
  if (result.ok) {
    revalidatePath(`/settings/users/${parsed.data.userId}`);
    revalidatePath("/settings/users");
  }
  return toActionResult(result, parsed.data.isActive ? "User reactivated." : "User deactivated.");
}

// ---------------------------------------------------------------------------
// Roles (specification Section 7)
// ---------------------------------------------------------------------------

const roleInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  description: z.string().trim().max(2000).optional(),
});

export type RoleActionResult =
  | { ok: true; message: string; roleId: string }
  | { ok: false; error: string };

export async function createRoleAction(input: unknown): Promise<RoleActionResult> {
  const parsed = roleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("roles.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createRole(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings/roles");
  return { ok: true, message: "Role created.", roleId: result.data.id };
}

const roleIdSchema = z.object({ roleId: uuid });

export async function updateRoleAction(input: unknown): Promise<ActionResult> {
  const parsed = roleIdSchema.extend(roleInputSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("roles.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateRole(auth.actor, parsed.data.roleId, parsed.data);
  if (result.ok) {
    revalidatePath(`/settings/roles/${parsed.data.roleId}`);
    revalidatePath("/settings/roles");
  }
  return toActionResult(result, "Role updated.");
}

const duplicateRoleSchema = z.object({ roleId: uuid, name: z.string().trim().max(80).optional() });

export async function duplicateRoleAction(input: unknown): Promise<RoleActionResult> {
  const parsed = duplicateRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("roles.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await duplicateRole(auth.actor, parsed.data.roleId, parsed.data.name);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings/roles");
  return { ok: true, message: "Role duplicated.", roleId: result.data.id };
}

export async function deleteRoleAction(input: unknown): Promise<ActionResult> {
  const parsed = roleIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("roles.delete");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await deleteRole(auth.actor, parsed.data.roleId);
  if (result.ok) revalidatePath("/settings/roles");
  return toActionResult(result, "Role deleted.");
}

// ---------------------------------------------------------------------------
// User creation (specification Section 4) — invitation flow
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  email: z.email("Enter a valid email address."),
  fullName: z.string().trim().min(1, "Name is required.").max(160),
  jobTitle: z.string().trim().max(120).optional(),
  roleIds: z.array(uuid).max(50),
});

export type CreateUserActionResult =
  | { ok: true; message: string; userId: string }
  | { ok: false; error: string };

export async function createUserAction(input: unknown): Promise<CreateUserActionResult> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("users.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createUser(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings/users");
  return { ok: true, message: "Invitation sent.", userId: result.data.id };
}
