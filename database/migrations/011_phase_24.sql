-- ─── Phase 24: Complete AI Tooth Segmentation Engine ──────────────────────────
-- All statements are additive / idempotent.

-- ─── Editable per-tooth masks ────────────────────────────────────────────────
-- Stores vertex-index sets for each region type per tooth per job.
-- mask_data: { "vertices": [v1, v2, ...], "normals": [...] }
-- confidence_heatmap: { "v_idx": score, ... } — per-vertex AI confidence

CREATE TABLE IF NOT EXISTS segmentation_masks (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              uuid        NOT NULL REFERENCES segmentation_jobs(id) ON DELETE CASCADE,
    tooth_number        int         NOT NULL,
    region_type         text        NOT NULL DEFAULT 'crown'
                                    CHECK (region_type IN (
                                      'crown','root','gingiva',
                                      'implant','restoration','supernumerary'
                                    )),
    mask_data           jsonb       NOT NULL DEFAULT '{"vertices":[],"normals":[]}',
    confidence_heatmap  jsonb       NOT NULL DEFAULT '{}',
    brush_radius_mm     float       NOT NULL DEFAULT 1.5,
    is_manually_edited  boolean     NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, tooth_number, region_type)
);

CREATE INDEX IF NOT EXISTS idx_seg_masks_job
    ON segmentation_masks(job_id);

-- ─── Undo/redo history stack ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS segmentation_history (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          uuid        NOT NULL REFERENCES segmentation_jobs(id) ON DELETE CASCADE,
    sequence_num    int         NOT NULL,
    action_type     text        NOT NULL,
    -- brush | erase | grow | shrink | smooth | merge | split
    -- | region_grow | auto_correct | boundary_smooth
    tooth_number    int,
    region_type     text,
    before_state    jsonb       NOT NULL DEFAULT '{}',
    after_state     jsonb       NOT NULL DEFAULT '{}',
    is_undone       boolean     NOT NULL DEFAULT false,
    created_by      uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seg_history_job_seq
    ON segmentation_history(job_id, sequence_num DESC);

-- ─── Additive columns on tooth_segments ──────────────────────────────────────
-- Extend existing table with Phase 24 tissue/restoration fields.

ALTER TABLE tooth_segments ADD COLUMN IF NOT EXISTS tissue_type text
    CHECK (tissue_type IN ('tooth','gingiva','root_segment','implant','restoration'));

ALTER TABLE tooth_segments ADD COLUMN IF NOT EXISTS is_primary_tooth boolean NOT NULL DEFAULT false;

ALTER TABLE tooth_segments ADD COLUMN IF NOT EXISTS restoration_type text
    CHECK (restoration_type IN ('crown','veneer','filling','bridge_pontic','implant_crown','unknown'));

ALTER TABLE tooth_segments ADD COLUMN IF NOT EXISTS root_count int;

ALTER TABLE tooth_segments ADD COLUMN IF NOT EXISTS has_root_resorption boolean NOT NULL DEFAULT false;

-- ─── Queue priority tracking ─────────────────────────────────────────────────
-- Additive columns on segmentation_jobs for GPU / queue management.

ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS priority int NOT NULL DEFAULT 5;
ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS gpu_requested boolean NOT NULL DEFAULT false;
ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS gpu_device text;
ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS queue_position int;
ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;
ALTER TABLE segmentation_jobs ADD COLUMN IF NOT EXISTS onnx_model_path text;
