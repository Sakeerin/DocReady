-- Phase S9: Pilot tracking (DR-901 to DR-906)
-- Identifiers and numeric metrics only: no tax IDs, names or document text.

CREATE TABLE IF NOT EXISTS public.pilot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.accounting_offices(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL,
  period_id UUID,
  mode TEXT NOT NULL CHECK (mode IN ('baseline', 'assisted')),
  documents INTEGER NOT NULL CHECK (documents > 0),
  active_seconds INTEGER NOT NULL CHECK (active_seconds >= 0),
  support_seconds INTEGER NOT NULL DEFAULT 0 CHECK (support_seconds >= 0),
  review_rounds INTEGER NOT NULL DEFAULT 0 CHECK (review_rounds >= 0),
  reworked_documents INTEGER NOT NULL DEFAULT 0 CHECK (reworked_documents >= 0),
  cost_satang BIGINT NOT NULL DEFAULT 0 CHECK (cost_satang >= 0),
  onboarding_minutes INTEGER CHECK (onboarding_minutes >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_pilot_events_client
    FOREIGN KEY (office_id, client_id)
    REFERENCES public.client_companies(office_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.pilot_review_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.accounting_offices(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL,
  document_id UUID NOT NULL,
  sample_group TEXT NOT NULL CHECK (sample_group IN ('reviewer_accepted', 'reviewer_corrected', 'ai_abstained')),
  category TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('correct', 'incorrect')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_pilot_samples_document
    FOREIGN KEY (office_id, client_id, document_id)
    REFERENCES public.documents(office_id, client_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.pilot_wtp_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.accounting_offices(id) ON DELETE RESTRICT,
  client_id UUID,
  respondent_role TEXT NOT NULL CHECK (respondent_role IN ('accountant', 'office_owner', 'client_admin')),
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('subscription_page_allowance', 'per_client_seat', 'per_page', 'other')),
  price_band TEXT NOT NULL CHECK (price_band IN ('none', 'low', 'mid', 'high')),
  would_continue BOOLEAN NOT NULL,
  reason_code TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pilot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_review_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_wtp_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY pilot_events_office_isolation ON public.pilot_events
  FOR ALL
  USING (public.user_has_office_access(office_id))
  WITH CHECK (public.user_has_office_access(office_id));

CREATE POLICY pilot_review_samples_office_isolation ON public.pilot_review_samples
  FOR ALL
  USING (public.user_has_office_access(office_id))
  WITH CHECK (public.user_has_office_access(office_id));

CREATE POLICY pilot_wtp_office_isolation ON public.pilot_wtp_responses
  FOR ALL
  USING (public.user_has_office_access(office_id))
  WITH CHECK (public.user_has_office_access(office_id));
