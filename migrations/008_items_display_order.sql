ALTER TABLE IF EXISTS items
  ADD COLUMN IF NOT EXISTS display_order integer;

ALTER TABLE IF EXISTS items
  DROP CONSTRAINT IF EXISTS items_display_order_check;

ALTER TABLE IF EXISTS items
  ADD CONSTRAINT items_display_order_check
  CHECK (display_order IS NULL OR display_order >= 1);
