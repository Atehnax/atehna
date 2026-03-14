CREATE TABLE IF NOT EXISTS catalog_categories (
  id text PRIMARY KEY,
  parent_id text REFERENCES catalog_categories(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  admin_notes text,
  banner_image text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_categories_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT catalog_categories_parent_slug_unique UNIQUE (parent_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent_position
  ON catalog_categories(parent_id, position);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent
  ON catalog_categories(parent_id);
