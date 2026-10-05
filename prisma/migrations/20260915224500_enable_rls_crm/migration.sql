-- ---------------------------------------------------------------------------
-- Enable Row Level Security on the Phase 2 (CRM) tables.
--
-- Same posture as 20260910120100_enable_rls and 20260910123000_harden_public_schema:
-- the application reads and writes exclusively through Prisma, which connects
-- as the table owner and is not subject to RLS. What this protects is the
-- OTHER door -- Supabase exposing every `public` table to PostgREST for anyone
-- holding the publishable (anon) key. RLS with no permissive policies makes
-- that door return zero rows.
--
-- The default-privilege REVOKE from 20260910123000 already stops Supabase from
-- auto-granting `anon`/`authenticated` on these new tables, so the REVOKE
-- below is redundant in principle. It is included anyway, matching the
-- original 20260910120100 migration's belt-and-braces approach, rather than
-- relying solely on a default-privilege scope this migration does not itself
-- set. See docs/PERMISSIONS.md §5.
--
-- No `FORCE` (would apply RLS to the table owner too and lock the application
-- out of its own tables). See docs/ARCHITECTURE.md §4.
-- ---------------------------------------------------------------------------

ALTER TABLE "pricing_tiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buyers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buyer_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_role text;
  target_table text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      FOREACH target_table IN ARRAY ARRAY[
        'pricing_tiers', 'buyers', 'buyer_contacts', 'customers'
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
