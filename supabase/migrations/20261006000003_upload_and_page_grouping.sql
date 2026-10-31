-- ============================================================================
-- DocReady Migration: Upload Sessions, Asset Pages & Page Grouping (20261006000003_upload_and_page_grouping.sql)
-- ============================================================================

-- 1. Upload Sessions
CREATE TABLE IF NOT EXISTS upload_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    period_id UUID NOT NULL,
    filename TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'uploaded', 'completed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, period_id) REFERENCES periods(office_id, client_id, id) ON DELETE CASCADE
);

-- 2. Asset Pages
CREATE TABLE IF NOT EXISTS asset_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    source_asset_id UUID NOT NULL,
    page_number INT NOT NULL,
    preview_key TEXT NOT NULL,
    width INT NOT NULL DEFAULT 1240,
    height INT NOT NULL DEFAULT 1754,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, source_asset_id) REFERENCES source_assets(office_id, client_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, id),
    UNIQUE(source_asset_id, page_number)
);

-- 3. Document Pages (Mapping between logical Document and Asset Page)
CREATE TABLE IF NOT EXISTS document_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    document_id UUID NOT NULL,
    asset_page_id UUID NOT NULL,
    page_number INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE,
    FOREIGN KEY (office_id, client_id, asset_page_id) REFERENCES asset_pages(office_id, client_id, id) ON DELETE CASCADE,
    UNIQUE(document_id, asset_page_id)
);

-- 4. Outbox Events for Reliable Processing & Reconciliation
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE asset_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_pages FORCE ROW LEVEL SECURITY;

ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pages FORCE ROW LEVEL SECURITY;

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

CREATE POLICY upload_sessions_isolation_policy ON upload_sessions
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY asset_pages_isolation_policy ON asset_pages
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY document_pages_isolation_policy ON document_pages
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY outbox_events_isolation_policy ON outbox_events
    FOR ALL
    USING (public.user_has_office_access(office_id))
    WITH CHECK (public.user_has_office_access(office_id));

CREATE INDEX idx_upload_sessions_tenant ON upload_sessions(office_id, client_id, status);
CREATE INDEX idx_outbox_events_status ON outbox_events(status, created_at);
