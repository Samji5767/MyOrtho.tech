-- Phase 25: Automatic Segmentation Correction
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS auto_correction_reports (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  uuid        NOT NULL REFERENCES segmentation_jobs(id) ON DELETE CASCADE,
    organization_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    total_issues            int         NOT NULL DEFAULT 0,
    critical_count          int         NOT NULL DEFAULT 0,
    warning_count           int         NOT NULL DEFAULT 0,
    info_count              int         NOT NULL DEFAULT 0,
    auto_fixed_count        int         NOT NULL DEFAULT 0,
    mesh_validity_score     float,
    analysis_duration_ms    int,
    analyzed_by             uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    analyzed_at             timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id)
);

CREATE TABLE IF NOT EXISTS auto_correction_items (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id           uuid        NOT NULL REFERENCES auto_correction_reports(id) ON DELETE CASCADE,
    tooth_number        int,
    region_type         text,
    issue_type          text        NOT NULL,
    severity            text        NOT NULL CHECK (severity IN ('critical','warning','info')),
    description         text        NOT NULL,
    suggested_action    text        NOT NULL,
    auto_fixable        boolean     NOT NULL DEFAULT false,
    is_repaired         boolean     NOT NULL DEFAULT false,
    repair_details      jsonb       NOT NULL DEFAULT '{}',
    repaired_by         uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    repaired_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_correction_items_report
    ON auto_correction_items(report_id);

CREATE INDEX IF NOT EXISTS idx_auto_correction_reports_job
    ON auto_correction_reports(job_id);

CREATE INDEX IF NOT EXISTS idx_auto_correction_reports_org
    ON auto_correction_reports(organization_id);
