-- ---------------------------------------------------------------------------
-- Harden the whole `public` schema against the browser-facing API roles.
--
-- WHY THIS EXISTS
--
-- The previous migration (20260910120100_enable_rls) locked down the seven
-- tables the application declares. It did not — could not — cover
-- `_prisma_migrations`, which Prisma creates itself, in `public`, where
-- Supabase's default privileges automatically grant ALL to `anon` and
-- `authenticated`.
--
-- The result was verified against the live project: holding nothing but the
-- publishable/anon key, an anonymous caller could read the migration history
-- through PostgREST and issue a DELETE against it (HTTP 204). Destroying that
-- table makes `prisma migrate deploy` attempt to re-run every migration, which
-- fails on existing objects and can leave the schema in a state that needs
-- manual repair.
--
-- WHAT THIS DOES
--
-- Rather than naming tables, it sweeps the schema, so any table added later —
-- by us, by Prisma, or by a tool — is covered the moment this runs:
--
--   1. ENABLE ROW LEVEL SECURITY on every ordinary table in `public`.
--   2. REVOKE ALL on every table and sequence from `anon` and `authenticated`.
--   3. Remove the DEFAULT PRIVILEGES that re-grant those rights to future
--      tables, so the hole does not silently reopen on the next migration.
--
-- RLS is enabled WITHOUT `FORCE`, so the table owner (how Prisma connects) is
-- unaffected. See docs/ARCHITECTURE.md §4.
--
-- The application never reads business tables from the browser, so nothing here
-- costs us functionality. If a future feature genuinely needs direct
-- browser access to a table, it must add an explicit, reviewed GRANT and a
-- policy for that one table — a deliberate act, not a default.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  target_role text;
  target_table text;
BEGIN
  -- 1. RLS on every ordinary table in public (idempotent).
  FOR target_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
  END LOOP;

  -- 2 and 3. Strip the public API roles, if they exist (they do on Supabase,
  -- they do not on a bare local PostgreSQL).
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', target_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', target_role);

      -- Stop future objects created by THIS role from being auto-granted.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
        target_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
        target_role
      );
    END IF;
  END LOOP;
END
$$;
