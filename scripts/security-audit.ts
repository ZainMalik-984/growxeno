/* eslint-disable @typescript-eslint/no-unused-expressions -- this report script records PASS/FAIL with terse `cond ? record(...) : record(...)` lines */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Data-exposure audit against the LIVE Supabase project (Phase 10).
 *
 * Question answered: with only the public (publishable) key — the one shipped
 * to every browser — what can an outsider read or call? The application talks
 * to Postgres as the owner through Prisma, so this is about the *other* door:
 * Supabase's auto-generated PostgREST / GraphQL / Storage / Realtime APIs.
 *
 * Read-only: introspection queries plus GET/POST probes that only ask for
 * metadata or attempt reads. Nothing is written. Exits non-zero on any FAIL.
 *
 *   pnpm security:audit
 */

type Result = { level: "PASS" | "FAIL" | "WARN"; name: string; detail?: string };
const results: Result[] = [];
const record = (level: Result["level"], name: string, detail?: string) => results.push({ level, name, detail });
const expectEmpty = (name: string, rows: unknown[], describe: (row: never) => string) =>
  rows.length === 0
    ? record("PASS", name)
    : record("FAIL", name, rows.map((r) => describe(r as never)).join("; "));

async function main() {
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!dbUrl || !apiUrl || !publicKey) throw new Error("DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });
  const q = <T>(sql: string) => prisma.$queryRawUnsafe<T[]>(sql);

  try {
    // ---- Tables: RLS on, no policies, no grants ---------------------------------
    const tables = await q<{ name: string; rls: boolean }>(
      `SELECT c.relname AS name, c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r','p') ORDER BY 1`,
    );
    expectEmpty(`RLS enabled on all ${tables.length} public tables`, tables.filter((t) => !t.rls), (t: { name: string }) => `${t.name} has RLS OFF`);

    expectEmpty(
      "No RLS policies on public tables (default-deny for the browser key)",
      await q(`SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'`),
      (p: { tablename: string; policyname: string }) => `${p.tablename}.${p.policyname}`,
    );

    expectEmpty(
      "anon/authenticated/PUBLIC hold no table privileges in public",
      await q(`SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
               WHERE table_schema = 'public' AND grantee IN ('anon','authenticated','PUBLIC')`),
      (g: { grantee: string; table_name: string; privilege_type: string }) => `${g.grantee} ${g.privilege_type} ${g.table_name}`,
    );
    expectEmpty(
      "No column-level privileges for anon/authenticated/PUBLIC in public",
      await q(`SELECT grantee, table_name, column_name FROM information_schema.role_column_grants
               WHERE table_schema = 'public' AND grantee IN ('anon','authenticated','PUBLIC')`),
      (g: { grantee: string; table_name: string; column_name: string }) => `${g.grantee} ${g.table_name}.${g.column_name}`,
    );

    // ---- Views, functions, sequences, default privileges ------------------------
    expectEmpty(
      "No views or materialized views in public (PostgREST would expose them)",
      await q(`SELECT viewname AS name FROM pg_views WHERE schemaname = 'public'
               UNION ALL SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'`),
      (v: { name: string }) => v.name,
    );

    const fns = await q<{ name: string; secdef: boolean; anon: boolean; ext: boolean }>(
      `SELECT p.proname AS name, p.prosecdef AS secdef,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
              EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') AS ext
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'`,
    );
    expectEmpty("No application-defined functions in public callable as RPC by anon", fns.filter((f) => !f.ext && f.anon), (f: { name: string }) => f.name);
    expectEmpty("No SECURITY DEFINER functions in public", fns.filter((f) => f.secdef), (f: { name: string }) => f.name);
    const extFns = fns.filter((f) => f.ext && f.anon);
    if (extFns.length > 0) {
      record(
        "WARN",
        `${extFns.length} extension functions in public are callable as /rpc by anon`,
        "Extension helpers read no table, but they are needless API surface: keep extensions in the `extensions` schema (see 20260919120000_harden_api_surface).",
      );
    }

    expectEmpty(
      "anon/authenticated cannot use sequences (order_number would leak volume)",
      await q(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind = 'S'
                 AND (has_sequence_privilege('anon', c.oid, 'USAGE') OR has_sequence_privilege('authenticated', c.oid, 'USAGE')
                      OR has_sequence_privilege('anon', c.oid, 'SELECT') OR has_sequence_privilege('authenticated', c.oid, 'SELECT'))`),
      (s: { name: string }) => s.name,
    );
    // Default privileges apply to objects the OWNING role creates later. Ours (the migration role) must
    // grant nothing to the API roles. Supabase's internal `supabase_admin` role has its own defaults; it
    // creates nothing here and we cannot alter them, so those are reported but are not a failure.
    const defaults = await q<{ kind: string; owner: string; acl: string; mine: boolean }>(
      `SELECT d.defaclobjtype::text AS kind, r.rolname AS owner, d.defaclacl::text AS acl, (r.rolname = current_user) AS mine
       FROM pg_default_acl d JOIN pg_roles r ON r.oid = d.defaclrole JOIN pg_namespace n ON n.oid = d.defaclnamespace
       WHERE n.nspname = 'public' AND (d.defaclacl::text LIKE '%anon=%' OR d.defaclacl::text LIKE '%authenticated=%')`,
    );
    expectEmpty(
      "No default privileges from the migration role would auto-grant future public objects to anon/authenticated",
      defaults.filter((d) => d.mine),
      (d: { kind: string; owner: string; acl: string }) => `${d.owner}/${d.kind}: ${d.acl}`,
    );
    if (defaults.some((d) => !d.mine)) {
      record("WARN", "Supabase-internal `supabase_admin` default privileges exist for public", "Apply only to objects supabase_admin itself creates in public; the application never does.");
    }

    // ---- Storage and Realtime ---------------------------------------------------
    expectEmpty("No public Storage buckets", await q(`SELECT id AS name FROM storage.buckets WHERE public = true`), (b: { name: string }) => b.name);
    expectEmpty(
      "No Storage policies grant anon/authenticated access",
      await q(`SELECT policyname AS name FROM pg_policies WHERE schemaname = 'storage'
               AND (roles::text LIKE '%anon%' OR roles::text LIKE '%authenticated%' OR roles::text LIKE '%public%')`),
      (p: { name: string }) => p.name,
    );
    expectEmpty(
      "No business table is published to Supabase Realtime",
      await q(`SELECT tablename AS name FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'`),
      (t: { name: string }) => t.name,
    );

    // ---- Live probes with ONLY the public key -----------------------------------
    const headers = { apikey: publicKey, Authorization: `Bearer ${publicKey}` };
    const get = async (path: string, init?: RequestInit) => fetch(`${apiUrl}${path}`, { headers, ...init });

    const leaked: string[] = [];
    for (const t of tables) {
      const res = await get(`/rest/v1/${t.name}?select=*&limit=1`);
      const body = await res.text();
      // Denied is 401/403/404, or 200 with an empty array (RLS filtering). Any returned row is a leak.
      if (res.ok && body.trim() !== "[]") leaked.push(`${t.name} returned data`);
    }
    if (leaked.length === 0) record("PASS", `PostgREST: public key reads no row from any of ${tables.length} tables`);
    else record("FAIL", "PostgREST: public key can read table data", leaked.join("; "));

    const write = await get(`/rest/v1/users`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" });
    write.status >= 400 ? record("PASS", `PostgREST: public key cannot INSERT (HTTP ${write.status})`) : record("FAIL", "PostgREST: public key INSERT accepted", String(write.status));
    const del = await get(`/rest/v1/_prisma_migrations?id=not.is.null`, { method: "DELETE" });
    del.status >= 400 ? record("PASS", `PostgREST: public key cannot DELETE (HTTP ${del.status})`) : record("FAIL", "PostgREST: public key DELETE accepted", String(del.status));

    const spec = await get(`/rest/v1/`);
    const specText = await spec.text();
    const named = tables.filter((t) => specText.includes(`"/${t.name}"`)).map((t) => t.name);
    named.length === 0
      ? record("PASS", "PostgREST OpenAPI document does not disclose table or column names")
      : record("FAIL", "PostgREST OpenAPI document lists tables", named.join(", "));

    const gql = await get(`/graphql/v1`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ __schema { queryType { fields { name } } } }" }) });
    const gqlText = await gql.text();
    const gqlNamed = tables.filter((t) => new RegExp(`"${t.name.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}Collection"`).test(gqlText)).map((t) => t.name);
    gqlNamed.length === 0 ? record("PASS", `GraphQL endpoint exposes no business tables (HTTP ${gql.status})`) : record("FAIL", "GraphQL exposes tables", gqlNamed.join(", "));

    const buckets = await get(`/storage/v1/bucket`);
    const bucketBody = await buckets.text();
    buckets.ok && bucketBody.trim() !== "[]" ? record("FAIL", "Storage bucket list readable with the public key", bucketBody.slice(0, 200)) : record("PASS", `Storage: public key lists no buckets (HTTP ${buckets.status})`);

    // ---- Auth configuration -----------------------------------------------------
    const settings = (await (await get(`/auth/v1/settings`)).json()) as { disable_signup?: boolean; mailer_autoconfirm?: boolean; external?: Record<string, boolean> };
    settings.disable_signup === true
      ? record("PASS", "Supabase Auth: open self-signup is DISABLED (users are created by an administrator only)")
      : record("FAIL", "Supabase Auth: open self-signup is ENABLED", "Anyone with the public key could create an auth identity. Disable it: Authentication > Sign In / Providers > 'Allow new users to sign up' = off.");
    settings.mailer_autoconfirm === true
      ? record("WARN", "Supabase Auth: email auto-confirm is on", "New identities would not need to verify their email.")
      : record("PASS", "Supabase Auth: email confirmation required");
    const providers = Object.entries(settings.external ?? {}).filter(([k, v]) => v && k !== "email").map(([k]) => k);
    providers.length === 0 ? record("PASS", "Supabase Auth: no third-party sign-in providers enabled") : record("WARN", "Supabase Auth: third-party providers enabled", providers.join(", "));
  } finally {
    await prisma.$disconnect();
  }

  for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.name}${r.detail ? `\n      ${r.detail}` : ""}`);
  const failed = results.filter((r) => r.level === "FAIL").length;
  console.log(`\n${results.filter((r) => r.level === "PASS").length} passed, ${results.filter((r) => r.level === "WARN").length} warnings, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("security-audit failed to run:", error);
  process.exitCode = 2;
});
