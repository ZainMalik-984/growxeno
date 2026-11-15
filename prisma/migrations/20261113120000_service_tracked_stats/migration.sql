-- AlterTable
ALTER TABLE "services" ADD COLUMN "tracked_stats" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Starting switches by kind: a video service follows views, likes and comments;
-- a subscribers service its subscribers; watch hours nothing (YouTube keeps them private).
UPDATE "services" SET "tracked_stats" = ARRAY['views', 'likes', 'comments'] WHERE "metric_type" IN ('VIEWS', 'LIKES', 'COMMENTS');
UPDATE "services" SET "tracked_stats" = ARRAY['subscribers'] WHERE "metric_type" IN ('SUBSCRIBERS', 'FOLLOWERS');
