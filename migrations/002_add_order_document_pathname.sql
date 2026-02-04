ALTER TABLE order_documents
ADD COLUMN IF NOT EXISTS blob_pathname TEXT;
