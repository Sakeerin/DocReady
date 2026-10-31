-- ============================================================================
-- DocReady Database Schema Migration (20261006000000_init_docready_schema.sql)
-- Architecture: Dual-level scope (Office Scope & Client Scope) with Composite FKs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Offices (Accounting Firms)
CREATE TABLE IF NOT EXISTS offices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tax_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Office Memberships
CREATE TABLE IF NOT EXISTS office_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('office_owner', 'office_manager', 'preparer', 'read_only_reviewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(office_id, user_id)
);

-- 3. Client Companies (Must have composite unique key for composite FK referencing)
CREATE TABLE IF NOT EXISTS client_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tax_id TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT '00000',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(office_id, id)
);

-- 4. Client Memberships (Client Admin / Client Uploader)
CREATE TABLE IF NOT EXISTS client_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('client_admin', 'client_uploader')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id) REFERENCES client_companies(office_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, user_id)
);

-- 5. Staff Client Assignments (Which Preparers/Managers can access which Client Companies)
CREATE TABLE IF NOT EXISTS staff_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id) REFERENCES client_companies(office_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, user_id)
);

-- 6. Accounting Periods
CREATE TABLE IF NOT EXISTS periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    period_name TEXT NOT NULL, -- Format: YYYY-MM
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'approved', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id) REFERENCES client_companies(office_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, id)
);

-- 7. Immutable Source Assets
CREATE TABLE IF NOT EXISTS source_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    period_id UUID NOT NULL,
    storage_bucket TEXT NOT NULL CHECK (storage_bucket IN ('quarantine', 'originals', 'derived', 'exports')),
    storage_key TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'quarantined' CHECK (status IN ('quarantined', 'scanned_safe', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, period_id) REFERENCES periods(office_id, client_id, id) ON DELETE CASCADE,
    UNIQUE(office_id, client_id, id)
);

-- 8. Logical Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    period_id UUID NOT NULL,
    source_asset_id UUID NOT NULL,
    document_number TEXT, -- Maintained as String
    document_date DATE,
    primary_queue_category TEXT DEFAULT 'unknown',
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'needs_review', 'needs_resubmission', 'reviewed', 'excluded', 'approved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, period_id) REFERENCES periods(office_id, client_id, id) ON DELETE CASCADE,
    FOREIGN KEY (office_id, client_id, source_asset_id) REFERENCES source_assets(office_id, client_id, id) ON DELETE RESTRICT,
    UNIQUE(office_id, client_id, id)
);

-- Indices for rapid tenant-scoped querying
CREATE INDEX idx_client_companies_office ON client_companies(office_id);
CREATE INDEX idx_staff_assignments_user ON staff_assignments(office_id, user_id);
CREATE INDEX idx_documents_tenant_period ON documents(office_id, client_id, period_id, status);
