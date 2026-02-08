
-- Add service_type to catalog (recurring monthly, annual, one-time extra)
ALTER TABLE public.pricing_service_catalog
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'recurring';

-- Add diagnostic/complexity fields to proposals
ALTER TABLE public.pricing_proposals
  ADD COLUMN IF NOT EXISTS company_type text DEFAULT 'servicos',
  ADD COLUMN IF NOT EXISTS num_branches integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_digital_certificate boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS revenue_bracket text DEFAULT 'ate_100k',
  ADD COLUMN IF NOT EXISTS complexity_score numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sellable_hours_month numeric DEFAULT 150,
  ADD COLUMN IF NOT EXISTS fiscal_complexity text DEFAULT 'baixa',
  ADD COLUMN IF NOT EXISTS markup_taxes numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_civil_liability numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_pdd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_interest numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_profit numeric DEFAULT 0;

-- Add department-specific hourly rate to proposal items
ALTER TABLE public.pricing_proposal_items
  ADD COLUMN IF NOT EXISTS department_hourly_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'recurring';
