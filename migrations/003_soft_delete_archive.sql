ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE order_documents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_order_documents_deleted_at ON order_documents(deleted_at);

CREATE TABLE IF NOT EXISTS deleted_archive_entries (
  id BIGSERIAL PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('order', 'pdf')),
  order_id BIGINT,
  document_id BIGINT,
  label TEXT NOT NULL,
  payload JSONB,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 days')
);

CREATE INDEX IF NOT EXISTS idx_deleted_archive_entries_deleted_at
  ON deleted_archive_entries(deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_deleted_archive_entries_expires_at
  ON deleted_archive_entries(expires_at);
