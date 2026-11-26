-- Add thumbnail URL to fiverr_gigs
ALTER TABLE "fiverr_gigs" ADD COLUMN "thumbnail_url" TEXT;

-- Add orders to fiverr_gig_stats
ALTER TABLE "fiverr_gig_stats" ADD COLUMN "orders" INTEGER NOT NULL DEFAULT 0;
