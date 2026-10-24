-- Phase S8: Retention tombstones, legal holds & per-office feature flags (kill switches)
-- (DR-803, DR-806). Dual-level RLS (office_id, client_id).

CREATE TABLE IF NOT EXISTS public.asset_tombstones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.accounting_offices(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  deleted_by_user_id UUID NOT NULL,
  reason TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (office_id, client_id, asset_id),
  CONSTRAINT fk_tombstone_client
    FOREIGN KEY (office_id, client_id)
    REFERENCES public.client_companies(office_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.accounting_offices(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  placed_by_user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  CONSTRAINT fk_hold_client
    FOREIGN KEY (office_id, client_id)
    REFERENCES public.client_companies(office_id, id)
    ON DELETE RESTRICT
);

-- Kill switches: TRUE = feature is killed for that office. Uploads are always accepted.
CREATE TABLE IF NOT EXISTS public.feature_flags (
  office_id UUID PRIMARY KEY REFERENCES public.accounting_offices(id) ON DELETE CASCADE,
  kill_ocr BOOLEAN NOT NULL DEFAULT false,
  kill_jev BOOLEAN NOT NULL DEFAULT false,
  kill_auto_classification BOOLEAN NOT NULL DEFAULT false,
  kill_export BOOLEAN NOT NULL DEFAULT false,
  auto_approval_enabled BOOLEAN NOT NULL DEFAULT false CHECK (auto_approval_enabled = false),
  updated_by_user_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_tombstones_office_isolation ON public.asset_tombstones
  FOR ALL
  USING (public.user_has_office_access(office_id))
  WITH CHECK (public.user_has_office_access(office_id));

CREATE POLICY legal_holds_office_isolation ON public.legal_holds
  FOR ALL
  USING (public.user_has_office_access(office_id))
  WITH CHECK (public.user_has_office_access(office_id));

CREATE POLICY feature_flags_office_isolation ON public.feature_flags
  FOR ALL
  USING (public.user_has_office_access(office_id))
  WITH CHECK (public.user_has_office_access(office_id));
