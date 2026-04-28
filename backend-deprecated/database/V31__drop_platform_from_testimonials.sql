-- Removes the platform attribute from testimonials. The product no longer
-- distinguishes TikTok / Zalo / Instagram / Other — every review is
-- displayed identically as a standalone screenshot.

ALTER TABLE testimonials
  DROP COLUMN IF EXISTS platform;
