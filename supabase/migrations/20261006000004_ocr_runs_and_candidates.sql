-- ============================================================================
-- DocReady Migration: OCR Runs, Spans & Field Candidates (20261006000004_ocr_runs_and_candidates.sql)
-- ============================================================================

-- 1. OCR Runs (Async Checkpoint Tracking)
CREATE TABLE IF NOT EXISTS ocr_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('azure_read', 'google_vision', 'vision_llm', 'mock')),
    operation_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. OCR Spans & Relative Bounding Geometry
CREATE TABLE IF NOT EXISTS ocr_spans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ocr_run_id UUID NOT NULL REFERENCES ocr_runs(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    span_index INT NOT NULL,
    text TEXT NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
    bounding_x NUMERIC(5, 4) NOT NULL, -- Relative percentage 0.0 - 1.0
    bounding_y NUMERIC(5, 4) NOT NULL,
    bounding_width NUMERIC(5, 4) NOT NULL,
    bounding_height NUMERIC(5, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Field Candidates (Traceable proposed field values)
CREATE TABLE IF NOT EXISTS field_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
    span_ids TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ocr_runs_operation ON ocr_runs(operation_id);
CREATE INDEX idx_ocr_spans_run ON ocr_spans(ocr_run_id);
CREATE INDEX idx_field_candidates_doc ON field_candidates(document_id, field_name);
