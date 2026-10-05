-- ---------------------------------------------------------------------------
-- Enable Row Level Security on the Phase 7 (Finance) tables.
--
-- Same posture as every prior RLS migration: the application connects as the
-- table owner (not subject to RLS); this closes the PostgREST door for the
-- publishable/anon key. See docs/PERMISSIONS.md §5.
-- ---------------------------------------------------------------------------

ALTER TABLE "expense_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buyer_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "worker_payments" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_role text;
  target_table text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      FOREACH target_table IN ARRAY ARRAY[
        'expense_categories', 'expenses', 'buyer_payments', 'worker_payments'
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
