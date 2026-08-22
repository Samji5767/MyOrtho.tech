-- ============================================================================
-- Migration 075: canonical anatomical tooth-movement model
--
-- Background: tooth_movements (migration 003) stored movement as unnamed mesh
-- axes (translate_x/y/z, rotate_x/y/z) plus four scalar columns. Movement
-- semantics must never depend on arbitrary mesh coordinates, so this migration
-- replaces the axis columns with the standard signed orthodontic components:
--
--   mesiodistal_mm       mesial +  / distal −
--   buccolingual_mm      buccal +  / lingual −
--   occlusogingival_mm   extrusion + / intrusion −
--   rotation_deg         rotation about the tooth long axis (mesial-in +)
--   tip_deg              crown angulation: mesial tip + / distal tip −
--   torque_deg           root torque: buccal + / lingual −
--
-- Backfill maps the legacy columns through the arch-frame convention already
-- documented in the AI engine (+X = mesial, +Y = buccal, +Z = extrusion,
-- long-axis rotation about Z).
--
-- CHECK constraints are data-integrity bounds (transport-level sanity), not
-- clinical validation.
--
-- Safe to re-run: all operations are guarded.
-- ============================================================================

DO $mig$
BEGIN

  -- ── Add canonical columns ─────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tooth_movements' AND column_name = 'mesiodistal_mm'
  ) THEN
    EXECUTE $q$ALTER TABLE tooth_movements
      ADD COLUMN mesiodistal_mm double precision NOT NULL DEFAULT 0$q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tooth_movements' AND column_name = 'buccolingual_mm'
  ) THEN
    EXECUTE $q$ALTER TABLE tooth_movements
      ADD COLUMN buccolingual_mm double precision NOT NULL DEFAULT 0$q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tooth_movements' AND column_name = 'occlusogingival_mm'
  ) THEN
    EXECUTE $q$ALTER TABLE tooth_movements
      ADD COLUMN occlusogingival_mm double precision NOT NULL DEFAULT 0$q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tooth_movements' AND column_name = 'rotation_deg'
  ) THEN
    EXECUTE $q$ALTER TABLE tooth_movements
      ADD COLUMN rotation_deg double precision NOT NULL DEFAULT 0$q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tooth_movements' AND column_name = 'tip_deg'
  ) THEN
    EXECUTE $q$ALTER TABLE tooth_movements
      ADD COLUMN tip_deg double precision NOT NULL DEFAULT 0$q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tooth_movements' AND column_name = 'torque_deg'
  ) THEN
    EXECUTE $q$ALTER TABLE tooth_movements
      ADD COLUMN torque_deg double precision NOT NULL DEFAULT 0$q$;
  END IF;

  -- ── Backfill from legacy columns (only if they still exist) ───────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tooth_movements' AND column_name = 'translate_x'
  ) THEN
    EXECUTE $q$UPDATE tooth_movements SET
      mesiodistal_mm     = COALESCE(translate_x, 0),
      buccolingual_mm    = COALESCE(translate_y, 0),
      occlusogingival_mm = COALESCE(translate_z, 0)
                           + COALESCE(extrusion, 0) - COALESCE(intrusion, 0),
      rotation_deg       = COALESCE(rotate_z, 0),
      tip_deg            = COALESCE(tip, 0),
      torque_deg         = COALESCE(torque, 0)
      WHERE mesiodistal_mm = 0 AND buccolingual_mm = 0
        AND occlusogingival_mm = 0 AND rotation_deg = 0
        AND tip_deg = 0 AND torque_deg = 0$q$;
  END IF;

  -- ── Drop legacy columns ───────────────────────────────────────────────────
  EXECUTE $q$ALTER TABLE tooth_movements
    DROP COLUMN IF EXISTS translate_x,
    DROP COLUMN IF EXISTS translate_y,
    DROP COLUMN IF EXISTS translate_z,
    DROP COLUMN IF EXISTS rotate_x,
    DROP COLUMN IF EXISTS rotate_y,
    DROP COLUMN IF EXISTS rotate_z,
    DROP COLUMN IF EXISTS tip,
    DROP COLUMN IF EXISTS torque,
    DROP COLUMN IF EXISTS intrusion,
    DROP COLUMN IF EXISTS extrusion$q$;

  -- ── Data-integrity bounds ─────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_tooth_movements_mm_bounds'
  ) THEN
    EXECUTE $q$ALTER TABLE tooth_movements
      ADD CONSTRAINT ck_tooth_movements_mm_bounds CHECK (
        abs(mesiodistal_mm)     <= 20 AND
        abs(buccolingual_mm)    <= 20 AND
        abs(occlusogingival_mm) <= 20
      )$q$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_tooth_movements_deg_bounds'
  ) THEN
    EXECUTE $q$ALTER TABLE tooth_movements
      ADD CONSTRAINT ck_tooth_movements_deg_bounds CHECK (
        abs(rotation_deg) <= 90 AND
        abs(tip_deg)      <= 90 AND
        abs(torque_deg)   <= 90
      )$q$;
  END IF;

END $mig$;
