-- ---------------------------------------------------------------------------
-- Enable Row Level Security with a default-deny posture.
--
-- WHY THIS LOOKS LIKE IT DOES
--
-- The application reads and writes business data exclusively through Prisma,
-- which connects over the Postgres wire protocol as the database OWNER. A table
-- owner is NOT subject to RLS, so these policies do not (and are not intended
-- to) constrain the application. Authorization for the Prisma path is enforced
-- in server code -- see src/lib/auth/authorize.ts and docs/PERMISSIONS.md.
--
-- What RLS protects here is the OTHER door: Supabase exposes every table in the
-- `public` schema through PostgREST to anyone holding the publishable
-- (anon) key. Enabling RLS with NO permissive policies means that door returns
-- zero rows for every table, which is what we want -- the browser has no
-- business reading `users` or `user_permissions` directly.
--
-- NOTE ON "FORCE": we deliberately do NOT use
--   ALTER TABLE ... FORCE ROW LEVEL SECURITY
-- because FORCE applies RLS to the table owner as well, which would lock the
-- application itself out of its own database. If a future change moves the
-- runtime to a dedicated non-owner role (see docs/ARCHITECTURE.md §4,
-- PROPOSED), revisit this decision together with that change.
--
-- Any future direct-from-browser access must add an explicit, reviewed policy.
-- ---------------------------------------------------------------------------

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- Belt and braces: remove the table-level grants Supabase hands to the public
-- API roles, so that even a misconfigured policy cannot expose these tables.
-- Guarded because the `anon` / `authenticated` roles exist in a Supabase
-- project but not in a bare PostgreSQL instance (e.g. a local Docker database).
DO $$
DECLARE
  target_role text;
  target_table text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      FOREACH target_table IN ARRAY ARRAY[
        'users', 'roles', 'permissions', 'user_roles',
        'role_permissions', 'user_permissions', 'audit_logs'
      ] LOOP
        EXECUTE format(
          'REVOKE ALL ON TABLE public.%I FROM %I',
          target_table, target_role
        );
      END LOOP;
    END IF;
  END LOOP;
END
$$;
