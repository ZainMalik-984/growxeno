import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * docs/API.md must describe the real Server Actions (specification Section 153:
 * "Documentation must describe the actual implementation"). This fails the
 * moment an action is added, renamed or removed without the document following,
 * and — the security point — fails if any action does not call an authorization
 * function before doing anything else.
 */

const root = process.cwd();
const domains = readdirSync(join(root, "src/lib"), { withFileTypes: true }).filter((d) => d.isDirectory());

const actions: Array<{ file: string; name: string; body: string }> = [];
for (const dir of domains) {
  const file = join("src/lib", dir.name, "actions.ts");
  if (!existsSync(join(root, file))) continue;
  const source = readFileSync(join(root, file), "utf8");
  if (!source.includes('"use server"')) continue;
  for (const part of source.split(/^export async function /m).slice(1)) {
    actions.push({ file, name: part.split("(")[0], body: part });
  }
}

const doc = readFileSync(join(root, "docs/API.md"), "utf8");

// The login flow is public by nature; everything else must authorize.
const PUBLIC_BY_NATURE = new Set(["signIn", "signOut", "requestPasswordResetAction", "updatePasswordAction"]);
const AUTH_CALLS = ["authorizeAction(", "authorizeAuthenticatedAction(", "requirePermission(", "requireActor(", "requireAllPermissions(", "requireScope("];

describe("Server Actions", () => {
  it("finds the actions (guards against the scan silently matching nothing)", () => {
    expect(actions.length).toBeGreaterThan(60);
  });

  it.each(actions.map((a) => [a.file, a.name] as const))("%s — %s is listed in docs/API.md", (_file, name) => {
    expect(doc, `${name} is missing from docs/API.md`).toContain(`\`${name}\``);
  });

  it("every action except the public login flow calls an authorization function", () => {
    const unguarded = actions.filter((a) => !PUBLIC_BY_NATURE.has(a.name) && !AUTH_CALLS.some((call) => a.body.includes(call)));
    expect(unguarded.map((a) => `${a.file}: ${a.name}`)).toEqual([]);
  });

  it("no action accepts a target user id and then authorizes only as 'signed in'", () => {
    // authorizeAuthenticatedAction() is for self-scoped actions. If one also takes a userId from its
    // input it would be an escalation: anyone could act on anyone.
    const risky = actions.filter((a) => a.body.includes("authorizeAuthenticatedAction(") && /\b(userId|targetUserId|recipientId)\b/.test(a.body.split("authorizeAuthenticatedAction(")[0]));
    expect(risky.map((a) => `${a.file}: ${a.name}`)).toEqual([]);
  });
});
