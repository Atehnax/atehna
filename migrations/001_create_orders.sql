CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_type TEXT NOT NULL,
  organization_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  delivery_address TEXT,
  reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2),
  total_price NUMERIC(12, 2)
);

CREATE TABLE IF NOT EXISTS order_documents (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  blob_pathname TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_attachments (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
