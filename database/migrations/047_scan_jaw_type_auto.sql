-- Migration 047: Add 'auto' to scans.jaw_type CHECK constraint
-- ScanPanel defaults jawType to 'auto' (geometry-based AI auto-detection).
-- The original schema only listed 'maxillary', 'mandibular', 'both', causing
-- all uploads from ScanPanel (default jaw type) to fail with a constraint violation.

DO $$ DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'scans'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%jaw_type%';

  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE scans DROP CONSTRAINT ' || quote_ident(con_name);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'scans'::regclass
      AND contype = 'c'
      AND conname = 'scans_jaw_type_check'
  ) THEN
    ALTER TABLE scans ADD CONSTRAINT scans_jaw_type_check
      CHECK (jaw_type IN ('maxillary', 'mandibular', 'both', 'auto'));
  END IF;
END $$;
