-- ============================================================================
-- DocReady Migration: Checklists, Expected Items & Missing Requests (20261006000007_checklists_and_missing_requests.sql)
-- ============================================================================

-- 1. Versioned Checklist Templates (DR-601)
CREATE TABLE IF NOT EXISTS checklist_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(office_id, name, version)
);

-- 2. Expected Items per Period (DR-601 & DR-602)
CREATE TABLE IF NOT EXISTS expected_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    period_id UUID NOT NULL,
    title TEXT NOT NULL,
    vendor_name TEXT,
    expected_amount NUMERIC(15, 2),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('template', 'manual', 'csv_import')),
    requirement_status TEXT NOT NULL DEFAULT 'required' CHECK (requirement_status IN ('required', 'conditional', 'not_applicable')),
    resolution_note TEXT,
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, period_id) REFERENCES periods(office_id, client_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, id)
);

-- 3. Expected Item Matches (DR-603)
CREATE TABLE IF NOT EXISTS expected_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    expected_item_id UUID NOT NULL,
    document_id UUID NOT NULL,
    confirmed_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, expected_item_id) REFERENCES expected_items(office_id, client_id, id) ON DELETE CASCADE,
    FOREIGN KEY (office_id, client_id, document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, expected_item_id, document_id)
);

-- 4. Missing Document Requests (DR-604)
CREATE TABLE IF NOT EXISTS missing_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    period_id UUID NOT NULL,
    expected_item_id UUID,
    title TEXT NOT NULL,
    public_message TEXT NOT NULL,
    internal_note TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'responded', 'resolved')),
    resolution_note TEXT,
    resolved_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, period_id) REFERENCES periods(office_id, client_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, id)
);

-- 5. Client Request Responses (DR-605)
CREATE TABLE IF NOT EXISTS request_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    request_id UUID NOT NULL,
    responder_user_id UUID NOT NULL,
    response_type TEXT NOT NULL CHECK (response_type IN ('upload_file', 'no_transaction_explanation')),
    explanation_text TEXT,
    uploaded_document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, request_id) REFERENCES missing_requests(office_id, client_id, id) ON DELETE CASCADE,
    FOREIGN KEY (office_id, client_id, uploaded_document_id) REFERENCES documents(office_id, client_id, id) ON DELETE SET NULL
);

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE expected_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expected_items FORCE ROW LEVEL SECURITY;

ALTER TABLE expected_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE expected_matches FORCE ROW LEVEL SECURITY;

ALTER TABLE missing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE missing_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE request_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_responses FORCE ROW LEVEL SECURITY;

CREATE POLICY checklist_templates_isolation_policy ON checklist_templates
    FOR ALL
    USING (public.user_has_office_access(office_id))
    WITH CHECK (public.user_has_office_access(office_id));

CREATE POLICY expected_items_isolation_policy ON expected_items
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY expected_matches_isolation_policy ON expected_matches
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY missing_requests_isolation_policy ON missing_requests
    FOR ALL
    USING (
        public.user_has_client_access(office_id, client_id)
        AND (status <> 'draft' OR public.user_has_office_access(office_id))
    )
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY request_responses_isolation_policy ON request_responses
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE INDEX idx_expected_items_period ON expected_items(office_id, client_id, period_id);
CREATE INDEX idx_missing_requests_period ON missing_requests(office_id, client_id, period_id, status);
