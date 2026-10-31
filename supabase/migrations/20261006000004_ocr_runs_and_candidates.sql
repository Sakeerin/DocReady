-- ============================================================================
-- DocReady Migration: OCR Runs, Spans & Field Candidates (20261006000004_ocr_runs_and_candidates.sql)
-- ============================================================================

-- 1. OCR Runs (Async Checkpoint Tracking)
CREATE TABLE IF NOT EXISTS ocr_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    document_id UUID NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('azure_read', 'google_vision', 'vision_llm', 'mock')),
    operation_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, id)
);

-- 2. OCR Spans & Relative Bounding Geometry
CREATE TABLE IF NOT EXISTS ocr_spans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    ocr_run_id UUID NOT NULL,
    page_number INT NOT NULL,
    span_index INT NOT NULL,
    text TEXT NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
    bounding_x NUMERIC(5, 4) NOT NULL, -- Relative percentage 0.0 - 1.0
    bounding_y NUMERIC(5, 4) NOT NULL,
    bounding_width NUMERIC(5, 4) NOT NULL,
    bounding_height NUMERIC(5, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, ocr_run_id) REFERENCES ocr_runs(office_id, client_id, id) ON DELETE CASCADE
);

-- 3. Field Candidates (Traceable proposed field values)
CREATE TABLE IF NOT EXISTS field_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    document_id UUID NOT NULL,
    field_name TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
    span_ids TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE
);

ALTER TABLE ocr_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_runs FORCE ROW LEVEL SECURITY;

ALTER TABLE ocr_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_spans FORCE ROW LEVEL SECURITY;

ALTER TABLE field_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_candidates FORCE ROW LEVEL SECURITY;

CREATE POLICY ocr_runs_isolation_policy ON ocr_runs
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY ocr_spans_isolation_policy ON ocr_spans
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY field_candidates_isolation_policy ON field_candidates
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE INDEX idx_ocr_runs_operation ON ocr_runs(operation_id);
CREATE INDEX idx_ocr_spans_run ON ocr_spans(ocr_run_id);
CREATE INDEX idx_field_candidates_doc ON field_candidates(document_id, field_name);
