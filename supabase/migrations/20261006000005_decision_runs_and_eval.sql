-- ============================================================================
-- DocReady Migration: Decision Runs & Token Ledger (20261006000005_decision_runs_and_eval.sql)
-- ============================================================================

-- 1. Decision Runs
CREATE TABLE IF NOT EXISTS decision_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    document_id UUID NOT NULL,
    model_version TEXT NOT NULL,
    question_type TEXT NOT NULL,
    selected_candidate_id TEXT,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
    input_tokens INT NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(10, 8) NOT NULL DEFAULT 0.00000000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE
);

-- 2. Token Usage Ledger (Billing & Cost Accounting per Tenant)
CREATE TABLE IF NOT EXISTS token_usage_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID NOT NULL,
    client_id UUID NOT NULL,
    document_id UUID NOT NULL,
    provider TEXT NOT NULL,
    model_version TEXT NOT NULL,
    input_tokens INT NOT NULL,
    estimated_cost_usd NUMERIC(10, 8) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (office_id, client_id, document_id) REFERENCES documents(office_id, client_id, id) ON DELETE CASCADE
);

ALTER TABLE decision_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_runs FORCE ROW LEVEL SECURITY;

ALTER TABLE token_usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_ledger FORCE ROW LEVEL SECURITY;

CREATE POLICY decision_runs_isolation_policy ON decision_runs
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE POLICY token_usage_ledger_isolation_policy ON token_usage_ledger
    FOR ALL
    USING (public.user_has_client_access(office_id, client_id))
    WITH CHECK (public.user_has_client_access(office_id, client_id));

CREATE INDEX idx_decision_runs_doc ON decision_runs(document_id);
CREATE INDEX idx_token_ledger_tenant ON token_usage_ledger(office_id, client_id);
