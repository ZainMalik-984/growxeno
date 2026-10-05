-- ---------------------------------------------------------------------------
-- Enable Row Level Security on the Phase 6 (Daily Statistics) table.
--
-- Same posture as every prior RLS migration: the application connects as the
-- table owner (not subject to RLS); this closes the PostgREST door for the
-- publishable/anon key. See docs/PERMISSIONS.md §5.
-- ---------------------------------------------------------------------------

ALTER TABLE "daily_stats" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_role text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', 'daily_stats', target_role);
    END IF;
  END LOOP;
END
$$;
