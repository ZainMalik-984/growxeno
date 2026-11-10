-- Category image (2026-11-05, owner request). Stored in Supabase Storage bucket "category-images".

-- AlterTable
ALTER TABLE "categories" ADD COLUMN "image_path" VARCHAR(300);
