CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  buyer_type text NOT NULL CHECK (buyer_type IN ('individual', 'company', 'school')),
  status text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  street text NOT NULL,
  postal_code text NOT NULL,
  city text NOT NULL,
  notes text,
  company_name text,
  tax_id_or_vat_id text,
  institution_name text,
  currency text NOT NULL DEFAULT 'eur',
  subtotal_cents bigint NOT NULL,
  tax_cents bigint NOT NULL,
  total_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku text,
  name_snapshot text NOT NULL,
  unit_price_cents bigint NOT NULL,
  quantity integer NOT NULL,
  line_total_cents bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('predracun', 'offer', 'dobavnica', 'invoice')),
  document_number text,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_to_customer_at timestamptz
);

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attachment_type text NOT NULL CHECK (attachment_type IN ('school_purchase_order')),
  original_filename text,
  file_url text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_counters (
  counter_name text PRIMARY KEY,
  next_number bigint NOT NULL
);
