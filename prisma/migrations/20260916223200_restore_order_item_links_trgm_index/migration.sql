-- Restores the pg_trgm GIN index on order_item_links.normalized_url that the
-- previous migration (20260916223104_add_daily_statistics) accidentally
-- dropped. Prisma's schema DSL cannot declare a trigram index, so it has no
-- record of this one (hand-added in 20260916025241_add_orders) and diffs it
-- away as "extra" on every migration that touches unrelated tables. This
-- migration must be checked for and re-applied after every future
-- `prisma migrate dev` run until Prisma supports declaring GIN/trgm indexes
-- natively — see docs/DEVELOPMENT.md's migration gotcha.
CREATE INDEX IF NOT EXISTS "order_item_links_normalized_url_trgm_idx" ON "order_item_links" USING GIN ("normalized_url" gin_trgm_ops);
