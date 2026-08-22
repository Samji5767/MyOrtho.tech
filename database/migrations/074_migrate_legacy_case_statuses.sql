-- ============================================================================
-- Migration 074: migrate legacy case_status values to current canonical set
--
-- Background: schema.sql seeded case_status with a legacy set of values.
-- Migration 044 added the current set but never migrated existing rows.
-- Cases created before migration 044 may be stuck in unreachable workflow
-- states (scan_uploaded, segmenting, pending_approval, staging, manufacturing,
-- canceled) because WorkflowService.TRANSITIONS only references the new set.
--
-- Mapping (old → new):
--   scan_uploaded   → scan_review        (upload complete; awaiting review)
--   segmenting      → segmentation       (AI segmentation in progress)
--   pending_approval → clinical_review   (clinician approval pending)
--   staging         → planning           (stage generation in progress)
--   manufacturing   → active_treatment   (aligner production underway)
--   canceled        → cancelled          (spelling unification)
--
-- Safe to re-run: DO UPDATE is idempotent.
-- ============================================================================

UPDATE cases SET status = 'scan_review'::case_status,    updated_at = now()
  WHERE status = 'scan_uploaded'::case_status;

UPDATE cases SET status = 'segmentation'::case_status,   updated_at = now()
  WHERE status = 'segmenting'::case_status;

UPDATE cases SET status = 'clinical_review'::case_status, updated_at = now()
  WHERE status = 'pending_approval'::case_status;

UPDATE cases SET status = 'planning'::case_status,        updated_at = now()
  WHERE status = 'staging'::case_status;

UPDATE cases SET status = 'active_treatment'::case_status, updated_at = now()
  WHERE status = 'manufacturing'::case_status;

UPDATE cases SET status = 'cancelled'::case_status,       updated_at = now()
  WHERE status = 'canceled'::case_status;

-- Record a workflow event for each migrated case so audit history is complete.
-- Actor is NULL (system migration), role is 'system'.
INSERT INTO workflow_events (case_id, from_status, to_status, actor_id, actor_role, notes)
  SELECT c.id, 'scan_uploaded', 'scan_review', NULL, 'system',
         'Automated status migration from legacy value (migration 074)'
    FROM cases c
   WHERE c.status = 'scan_review'
     AND NOT EXISTS (
       SELECT 1 FROM workflow_events we
        WHERE we.case_id = c.id AND we.to_status = 'scan_review'
          AND we.actor_role = 'system'
     );

-- Clean up obsolete legacy ENUM values that are now unreachable.
-- PostgreSQL does not support DROP VALUE; we leave legacy labels in the type
-- but they will never appear in new rows. Comment here documents intent.
-- Legacy orphans: scan_uploaded, segmenting, pending_approval, staging, manufacturing, canceled
