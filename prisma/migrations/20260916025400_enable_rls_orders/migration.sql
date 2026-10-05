-- ---------------------------------------------------------------------------
-- Enable Row Level Security on the Phase 4 (Orders) tables.
--
-- Same posture as every prior RLS migration: the application connects as the
-- table owner (not subject to RLS); this closes the PostgREST door for the
-- publishable/anon key. See docs/PERMISSIONS.md §5.
-- ---------------------------------------------------------------------------

ALTER TABLE "outsourced_workers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_item_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_outbox" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_role text;
  target_table text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      FOREACH target_table IN ARRAY ARRAY[
        'outsourced_workers', 'orders', 'order_items', 'order_item_links',
        'order_notes', 'order_activity', 'notification_outbox'
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
