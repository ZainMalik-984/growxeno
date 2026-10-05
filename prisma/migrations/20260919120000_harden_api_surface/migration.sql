-- ---------------------------------------------------------------------------
-- Phase 10: shrink what Supabase's auto-generated API can reach.
--
-- 1. pg_trgm was installed in `public` (Phase 4). PostgREST exposes every
--    function in an exposed schema as `/rest/v1/rpc/<name>`, so its 31 helper
--    functions (similarity(), show_trgm(), ...) were callable with the public
--    key. They read no table, so they could not leak data, but they were
--    needless API surface. Supabase's own guidance is to keep extensions in the
--    `extensions` schema, which PostgREST does not expose. Moving it does not
--    touch the 18 trigram indexes (an index binds its operator class by OID) —
--    verified before writing this: `ILIKE` still plans and still uses
--    `buyers_name_trgm_idx`.
--
-- 2. `postgres` (the role that runs these migrations) had a default privilege
--    granting EXECUTE on FUTURE functions in `public` to anon/authenticated, so
--    any function a later migration defined would have been RPC-callable by
--    default. Revoke it: a future function must be granted deliberately.
--    (Tables and sequences were already covered by 20260910123000.)
-- ---------------------------------------------------------------------------

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
