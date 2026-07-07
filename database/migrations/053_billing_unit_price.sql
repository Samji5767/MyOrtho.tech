-- Add unit_price_cents to billing_usage_meters so PAYG revenue can be calculated
-- in dollars rather than as a row count. Defaults to 0 for existing rows.
ALTER TABLE billing_usage_meters
  ADD COLUMN IF NOT EXISTS unit_price_cents integer NOT NULL DEFAULT 0;
