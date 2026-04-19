-- Customer review screenshots imported from external platforms
-- (TikTok, Shopee, Facebook, Instagram, Lazada, …)

CREATE TABLE IF NOT EXISTS testimonials (
  id              SERIAL       PRIMARY KEY,
  image_url       TEXT         NOT NULL,
  platform        TEXT         NOT NULL DEFAULT 'other',
  reviewer_name   TEXT,
  caption         TEXT,
  is_featured     BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_display
  ON testimonials (is_featured DESC, sort_order ASC, created_at DESC);

CREATE OR REPLACE FUNCTION testimonials_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_testimonials_updated_at ON testimonials;
CREATE TRIGGER trg_testimonials_updated_at
BEFORE UPDATE ON testimonials
FOR EACH ROW EXECUTE FUNCTION testimonials_set_updated_at();
