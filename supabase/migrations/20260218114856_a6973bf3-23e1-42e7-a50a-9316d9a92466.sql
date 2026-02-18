
-- Enum para canais de aquisição padronizados
CREATE TYPE public.acquisition_channel AS ENUM (
  'whatsapp',
  'social_media',
  'website_form',
  'referral',
  'direct_prospecting',
  'google_ads',
  'events',
  'other'
);

-- Adicionar campo de origem nos clientes existentes (retroativo)
ALTER TABLE public.clients ADD COLUMN acquisition_source public.acquisition_channel DEFAULT NULL;

-- Adicionar campo de origem padronizada nos leads (substituir texto livre)
ALTER TABLE public.leads ADD COLUMN acquisition_channel public.acquisition_channel DEFAULT NULL;

-- Tabela de investimentos em marketing mensal
CREATE TABLE public.marketing_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month DATE NOT NULL, -- primeiro dia do mês (ex: 2026-02-01)
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month)
);

-- RLS
ALTER TABLE public.marketing_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
ON public.marketing_investments
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger de updated_at
CREATE TRIGGER update_marketing_investments_updated_at
BEFORE UPDATE ON public.marketing_investments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
