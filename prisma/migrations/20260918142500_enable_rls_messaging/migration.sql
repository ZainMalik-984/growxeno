-- ---------------------------------------------------------------------------
-- Enable Row Level Security on the Phase 8 (Messaging/Notifications) tables.
--
-- Same posture as every prior RLS migration: the application connects as the
-- table owner (not subject to RLS); this closes the PostgREST door for the
-- publishable/anon key. See docs/PERMISSIONS.md §5.
--
-- No permissive policy is added for `notifications`, even though a future
-- Supabase Realtime subscription (docs/NOTIFICATIONS.md §9, deferred this
-- phase alongside the Redis/BullMQ queue) would need one scoped to
-- `recipient_id = auth.uid()`. Adding that policy is deliberately left for
-- when Realtime is actually wired up and can be reviewed together with it,
-- not added speculatively ahead of the feature that needs it.
-- ---------------------------------------------------------------------------

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_logs" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_role text;
  target_table text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      FOREACH target_table IN ARRAY ARRAY[
        'notifications', 'notification_templates', 'notification_preferences', 'message_logs'
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
