ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_notes TEXT;

CREATE TABLE IF NOT EXISTS order_payment_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
