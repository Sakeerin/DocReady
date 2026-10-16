-- ============================================================================
-- DocReady Dual-Level Row Level Security (20261006000001_enable_rls_policies.sql)
-- Strict Multi-tenant Scope Invariant: Office Scope AND Client Company Scope
-- ============================================================================

ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 1. Offices Policy: User must be a member of the office
CREATE POLICY office_isolation_policy ON offices
    FOR ALL USING (
        id IN (
            SELECT office_id FROM office_memberships WHERE user_id = auth.uid()
        )
    );

-- 2. Client Companies Policy:
-- User must be an Office Owner/Manager in that office OR explicitly assigned via staff_assignments / client_memberships
CREATE POLICY client_company_isolation_policy ON client_companies
    FOR ALL USING (
        office_id IN (
            SELECT office_id FROM office_memberships 
            WHERE user_id = auth.uid() AND role IN ('office_owner', 'office_manager')
        )
        OR id IN (
            SELECT client_id FROM staff_assignments WHERE user_id = auth.uid()
        )
        OR id IN (
            SELECT client_id FROM client_memberships WHERE user_id = auth.uid()
        )
    );

-- 3. Documents Policy:
-- User must have access to the specific client_id (not just the office_id!)
CREATE POLICY document_isolation_policy ON documents
    FOR ALL USING (
        (office_id, client_id) IN (
            SELECT office_id, id FROM client_companies
            WHERE office_id IN (
                SELECT office_id FROM office_memberships 
                WHERE user_id = auth.uid() AND role IN ('office_owner', 'office_manager')
            )
            OR id IN (
                SELECT client_id FROM staff_assignments WHERE user_id = auth.uid()
            )
            OR id IN (
                SELECT client_id FROM client_memberships WHERE user_id = auth.uid()
            )
        )
    );
