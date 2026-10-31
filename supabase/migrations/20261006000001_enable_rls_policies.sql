-- ============================================================================
-- DocReady Dual-Level Row Level Security (20261006000001_enable_rls_policies.sql)
-- Strict Multi-tenant Scope Invariant: Office Scope AND Client Company Scope
-- ============================================================================

-- Helper function: checks if the current authenticated user belongs to target_office_id
CREATE OR REPLACE FUNCTION public.user_has_office_access(target_office_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.office_memberships
    WHERE office_id = target_office_id
      AND user_id = auth.uid()
  );
$$;

-- Helper function: checks Dual-Level Scope (Office Owner/Manager OR assigned Staff OR Client Member)
CREATE OR REPLACE FUNCTION public.user_has_client_access(target_office_id UUID, target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.office_memberships
    WHERE office_id = target_office_id
      AND user_id = auth.uid()
      AND role IN ('office_owner', 'office_manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.staff_assignments
    WHERE office_id = target_office_id
      AND client_id = target_client_id
      AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.client_memberships
    WHERE office_id = target_office_id
      AND client_id = target_client_id
      AND user_id = auth.uid()
  );
$$;

ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE offices FORCE ROW LEVEL SECURITY;

ALTER TABLE office_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_companies FORCE ROW LEVEL SECURITY;

ALTER TABLE client_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods FORCE ROW LEVEL SECURITY;

ALTER TABLE source_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_assets FORCE ROW LEVEL SECURITY;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

-- 1. Offices Policy
CREATE POLICY office_isolation_policy ON offices
    FOR ALL
    USING (public.user_has_office_access(id))
    WITH CHECK (public.user_has_office_access(id));

-- 2. Office Memberships Policy
CREATE POLICY office_memberships_isolation_policy ON office_memberships
    FOR ALL
    USING (public.user_has_office_access(office_id))
    WITH CHECK (public.user_has_office_access(office_id));

-- 3. Client Companies Policy
CREATE POLICY client_company_isolation_policy ON client_companies
    FOR ALL
    USING (public.user_has_client_access(office_id, id))
    WITH CHECK (public.user_has_office_access(office_id));

-- 4. Client Memberships Policy
CREATE POLICY client_memberships_isolation_policy ON client_memberships
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_office_access(office_id));

-- 5. Staff Assignments Policy
CREATE POLICY staff_assignments_isolation_policy ON staff_assignments
    FOR ALL
    USING (public.user_has_office_access(office_id))
    WITH CHECK (public.user_has_office_access(office_id));

-- 6. Periods Policy
CREATE POLICY periods_isolation_policy ON periods
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

-- 7. Source Assets Policy
CREATE POLICY source_assets_isolation_policy ON source_assets
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

-- 8. Documents Policy
CREATE POLICY document_isolation_policy ON documents
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));
