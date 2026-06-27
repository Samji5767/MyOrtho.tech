-- ============================================================================
-- Migration 006: Phase 17B — Clinical Analysis Engine
--
-- Adds:
--   • case_analyses — persists Bolton ratios, Angle class, crowding/spacing,
--     overjet/overbite, tooth measurements, and IPR schedule per case
--
-- Safe to re-run: all statements use IF NOT EXISTS.
-- Run after: 001–005 migrations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_analyses (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id             uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

    -- Bolton Analysis ratios (%)
    bolton_overall      numeric(5,2),   -- norm: 91.3 ± 1.91
    bolton_anterior     numeric(5,2),   -- norm: 77.2 ± 1.65

    -- Tooth measurements: { "11": 8.5, "21": 8.5, ... } FDI notation, mm
    tooth_measurements  jsonb       NOT NULL DEFAULT '{}',

    -- Malocclusion
    angle_class         text        CHECK (angle_class IN (
                                      'Class I', 'Class II', 'Class II Div 1',
                                      'Class II Div 2', 'Class III')),
    overjet_mm          numeric(5,2),
    overbite_mm         numeric(5,2),

    -- Arch crowding (positive = crowding, negative = spacing), mm
    upper_crowding_mm   numeric(5,2),
    lower_crowding_mm   numeric(5,2),

    -- IPR schedule: [{ stage, toothA, toothB, amountMm }]
    ipr_schedule        jsonb       NOT NULL DEFAULT '[]',

    -- Complexity score 0–100
    complexity_score    int         CHECK (complexity_score BETWEEN 0 AND 100),

    -- Meta
    created_by          uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
    notes               text,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_analyses_case
    ON case_analyses(case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_analyses_actor
    ON case_analyses(created_by);
