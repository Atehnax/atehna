ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orders_is_draft ON orders (is_draft);

CREATE TABLE IF NOT EXISTS website_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  path TEXT NOT NULL,
  product_id TEXT,
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  user_id TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_events_created_at ON website_events (created_at);
CREATE INDEX IF NOT EXISTS idx_website_events_type ON website_events (event_type);
CREATE INDEX IF NOT EXISTS idx_website_events_path ON website_events (path);
CREATE INDEX IF NOT EXISTS idx_website_events_product ON website_events (product_id);
CREATE INDEX IF NOT EXISTS idx_website_events_visitor ON website_events (visitor_id);
