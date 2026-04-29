ALTER TABLE products ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

-- Index to speed up cleanup queries (find old drafts)
CREATE INDEX IF NOT EXISTS idx_products_is_draft_created_at ON products (is_draft, created_at) WHERE is_draft = true;
