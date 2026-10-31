-- Phase S7: Package Snapshots, Approvals, Export Jobs & Usage Ledger (DR-701 to DR-706)
-- Enforces dual-level RLS (office_id, client_id) and composite foreign keys

-- 1. Packages (Immutable Snapshot Header)
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL,
  period_id UUID NOT NULL,
  package_revision INTEGER NOT NULL DEFAULT 1 CHECK (package_revision >= 1),
  package_mode TEXT NOT NULL CHECK (package_mode IN ('complete_against_defined_list', 'received_documents_with_exceptions')),
  coverage_basis TEXT NOT NULL CHECK (coverage_basis IN ('complete_against_defined_list', 'received_documents_with_exceptions', 'received_only')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'invalidated_by_change', 'superseded')),
  checklist_revision_snapshot INTEGER NOT NULL DEFAULT 1,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (office_id, client_id, period_id, package_revision),
  UNIQUE (office_id, client_id, id),
  CONSTRAINT fk_packages_period
    FOREIGN KEY (office_id, client_id, period_id)
    REFERENCES public.periods(office_id, client_id, id)
    ON DELETE RESTRICT
);

-- 2. Package Items (Immutable Document Snapshot inside a Package)
CREATE TABLE IF NOT EXISTS public.package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL,
  client_id UUID NOT NULL,
  package_id UUID NOT NULL,
  document_id UUID NOT NULL,
  document_revision INTEGER NOT NULL CHECK (document_revision >= 1),
  document_roles TEXT[] NOT NULL DEFAULT ARRAY['invoice']::TEXT[],
  counting_role TEXT NOT NULL CHECK (counting_role IN ('primary_counting', 'supporting_non_counting', 'excluded_duplicate')),
  source_asset_id UUID,
  source_hash TEXT NOT NULL,
  page_range TEXT NOT NULL DEFAULT '1-1',
  derived_storage_path TEXT NOT NULL,
  derived_file_hash TEXT NOT NULL,
  fields_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, document_id),
  CONSTRAINT fk_package_items_package
    FOREIGN KEY (office_id, client_id, package_id)
    REFERENCES public.packages(office_id, client_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_package_items_document
    FOREIGN KEY (office_id, client_id, document_id)
    REFERENCES public.documents(office_id, client_id, id)
    ON DELETE RESTRICT
);

-- 3. Approvals (Human-in-the-Loop Approval Snapshot & Invalidation History)
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL,
  client_id UUID NOT NULL,
  package_id UUID NOT NULL,
  approved_by_user_id UUID NOT NULL,
  approval_note TEXT,
  exceptions_acknowledged BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalidated')),
  invalidated_reason TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ,
  CONSTRAINT fk_approvals_package
    FOREIGN KEY (office_id, client_id, package_id)
    REFERENCES public.packages(office_id, client_id, id)
    ON DELETE RESTRICT
);

-- 4. Export Jobs (XLSX + Split Derived PDFs + Manifest + ZIP in private 'exports' bucket)
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL,
  client_id UUID NOT NULL,
  package_id UUID NOT NULL,
  requested_by_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  storage_bucket TEXT NOT NULL DEFAULT 'exports' CHECK (storage_bucket = 'exports'),
  storage_path TEXT,
  sha256_checksum TEXT,
  file_size_bytes BIGINT,
  manifest_json JSONB,
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT fk_export_jobs_package
    FOREIGN KEY (office_id, client_id, package_id)
    REFERENCES public.packages(office_id, client_id, id)
    ON DELETE RESTRICT
);

-- 5. Usage & Cost Ledger Entries (DR-705)
CREATE TABLE IF NOT EXISTS public.usage_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL,
  period_id UUID,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('ocr_pages', 'jev_input_tokens', 'jev_output_tokens', 'storage_bytes', 'export_runs')),
  raw_units BIGINT NOT NULL CHECK (raw_units >= 0),
  billable_units BIGINT NOT NULL CHECK (billable_units >= 0),
  is_system_fault_reprocess BOOLEAN NOT NULL DEFAULT false,
  provider_cost_satang BIGINT NOT NULL DEFAULT 0 CHECK (provider_cost_satang >= 0),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (office_id, idempotency_key),
  CONSTRAINT fk_usage_ledger_client
    FOREIGN KEY (office_id, client_id)
    REFERENCES public.client_companies(office_id, id)
    ON DELETE RESTRICT
);

-- Enable & Force Row Level Security
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals FORCE ROW LEVEL SECURITY;

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.usage_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger_entries FORCE ROW LEVEL SECURITY;

-- Dual-Level RLS Policies (Office + Client Access)
CREATE POLICY packages_office_isolation ON public.packages
  FOR ALL
  USING (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id))
  WITH CHECK (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id));

CREATE POLICY package_items_office_isolation ON public.package_items
  FOR ALL
  USING (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id))
  WITH CHECK (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id));

CREATE POLICY approvals_office_isolation ON public.approvals
  FOR ALL
  USING (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id))
  WITH CHECK (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id));

CREATE POLICY export_jobs_office_isolation ON public.export_jobs
  FOR ALL
  USING (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id))
  WITH CHECK (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id));

CREATE POLICY usage_ledger_office_isolation ON public.usage_ledger_entries
  FOR ALL
  USING (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id))
  WITH CHECK (public.user_has_office_access(office_id) AND public.user_has_client_access(office_id, client_id));
