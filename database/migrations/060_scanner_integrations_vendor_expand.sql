-- 060: Expand scanner_integrations vendor CHECK constraint
-- Drops the restrictive check and replaces with a broader one

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find and drop the vendor CHECK constraint if it exists
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'scanner_integrations'::regclass
    AND contype = 'c'
    AND conname LIKE '%vendor%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE scanner_integrations DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Add a looser constraint covering supported vendors
ALTER TABLE scanner_integrations
  DROP CONSTRAINT IF EXISTS scanner_integrations_vendor_check;

ALTER TABLE scanner_integrations
  ADD CONSTRAINT scanner_integrations_vendor_check
  CHECK (vendor IN ('3Shape','Medit','iTero','Shining3D','Carestream','SprintRay','Formlabs','Asiga','Carbon'));

-- Add UNIQUE constraint so upsert (ON CONFLICT) works
ALTER TABLE scanner_integrations
  DROP CONSTRAINT IF EXISTS scanner_integrations_org_vendor_unique;

ALTER TABLE scanner_integrations
  ADD CONSTRAINT scanner_integrations_org_vendor_unique
  UNIQUE (organization_id, vendor);
