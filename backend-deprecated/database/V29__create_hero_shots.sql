-- Hero polaroid shots — admin-managed images shown in the homepage hero
-- collage. Always exactly 3 fixed slots (0, 1, 2); admin updates them in
-- place rather than adding/removing rows.

CREATE TABLE IF NOT EXISTS hero_shots (
  slot         INTEGER     PRIMARY KEY CHECK (slot IN (0, 1, 2)),
  image_url    TEXT,
  caption      TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 3 slots so the admin page has rows to edit on first load.
INSERT INTO hero_shots (slot, image_url, caption)
VALUES
  (0, NULL, NULL),
  (1, NULL, NULL),
  (2, NULL, NULL)
ON CONFLICT (slot) DO NOTHING;

CREATE OR REPLACE FUNCTION hero_shots_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hero_shots_updated_at ON hero_shots;
CREATE TRIGGER trg_hero_shots_updated_at
BEFORE UPDATE ON hero_shots
FOR EACH ROW EXECUTE FUNCTION hero_shots_set_updated_at();
