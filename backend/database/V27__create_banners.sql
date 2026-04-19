-- Homepage hero banners — admin-managed slides shown above the products grid.

CREATE TABLE IF NOT EXISTS banners (
  id           SERIAL       PRIMARY KEY,
  image_url    TEXT         NOT NULL,
  link_url     TEXT,
  alt_text     TEXT,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Public-display query: WHERE is_active ORDER BY sort_order, created_at DESC
CREATE INDEX IF NOT EXISTS idx_banners_display
  ON banners (is_active, sort_order ASC, created_at DESC);

CREATE OR REPLACE FUNCTION banners_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_banners_updated_at ON banners;
CREATE TRIGGER trg_banners_updated_at
BEFORE UPDATE ON banners
FOR EACH ROW EXECUTE FUNCTION banners_set_updated_at();
