
-- Tabela de templates de mensagens para envio de boletos
CREATE TABLE public.cora_message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  message_body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cora_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
ON public.cora_message_templates
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger updated_at
CREATE TRIGGER update_cora_message_templates_updated_at
BEFORE UPDATE ON public.cora_message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Templates padrão
INSERT INTO public.cora_message_templates (template_key, name, description, message_body) VALUES
('before_due', 'Boleto em dia', 'Mensagem enviada quando o boleto ainda não venceu', 'Olá {{nome}}! Segue o boleto de honorários contábeis referente a {{competencia}}, com vencimento em {{vencimento}}. Valor: R$ {{valor}}. Qualquer dúvida, estamos à disposição!'),
('after_due', 'Boleto vencido', 'Mensagem enviada quando o boleto está atrasado', 'Olá {{nome}}! Identificamos que o boleto de honorários referente a {{competencia}} está vencido desde {{vencimento}} ({{dias_atraso}} dias). Valor: R$ {{valor}}. Por favor, regularize o pagamento. Estamos à disposição!'),
('reminder', 'Lembrete (sem PDF)', 'Lembrete enviado sem anexo de boleto', 'Olá {{nome}}! Lembramos que o boleto de honorários contábeis referente a {{competencia}} vence em {{vencimento}}. Valor: R$ {{valor}}. Fique atento ao prazo!'),
('reminder_today', 'Lembrete vence hoje', 'Lembrete para boletos que vencem hoje', 'Olá {{nome}}! Seu boleto de honorários contábeis referente a {{competencia}} vence HOJE ({{vencimento}}). Valor: R$ {{valor}}. Não esqueça de efetuar o pagamento!');
