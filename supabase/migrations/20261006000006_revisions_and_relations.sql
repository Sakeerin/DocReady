-- ============================================================================
-- DocReady Migration: Document Revisions & Relations (20261006000006_revisions_and_relations.sql)
-- ============================================================================

-- Add revision_number column to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS revision_number INT NOT NULL DEFAULT 1;

-- 1. Document Revisions History (Audit Trail)
CREATE TABLE IF NOT EXISTS document_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    document_id UUID NOT NULL,
    revision_number INT NOT NULL,
    actor_user_id UUID NOT NULL,
    changes_json JSONB NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE,
    UNIQUE(document_id, revision_number)
);

-- 2. Document Relations (duplicate_of, supports, replacement)
CREATE TABLE IF NOT EXISTS document_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    document_id UUID NOT NULL,
    target_document_id UUID NOT NULL,
    relation_type TEXT NOT NULL CHECK (relation_type IN ('duplicate_of', 'supports', 'replacement')),
    confirmed_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE,
    FOREIGN KEY (office_id, client_id, target_document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, document_id, target_document_id)
);

-- 3. Quality & Review Issues
CREATE TABLE IF NOT EXISTS quality_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    document_id UUID NOT NULL,
    issue_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE
);

ALTER TABLE document_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_revisions FORCE ROW LEVEL SECURITY;

ALTER TABLE document_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_relations FORCE ROW LEVEL SECURITY;

ALTER TABLE quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_issues FORCE ROW LEVEL SECURITY;

CREATE POLICY document_revisions_isolation_policy ON document_revisions
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY document_relations_isolation_policy ON document_relations
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY quality_issues_isolation_policy ON quality_issues
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE INDEX idx_document_revisions_doc ON document_revisions(document_id, revision_number);
CREATE INDEX idx_document_relations_tenant ON document_relations(office_id, client_id, document_id);
