-- Create payroll_obligations table for tracking payroll-related obligations
CREATE TABLE public.payroll_obligations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT NOT NULL,
  client_cnpj TEXT NOT NULL,
  client_status TEXT NOT NULL DEFAULT 'Ativo',
  department TEXT NOT NULL DEFAULT 'Departamento Pessoal',
  obligation_name TEXT NOT NULL DEFAULT 'Folha de pagamento',
  competence TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delayed', 'completed')),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  gclick_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_payroll_obligations_status ON public.payroll_obligations(status);
CREATE INDEX idx_payroll_obligations_competence ON public.payroll_obligations(competence);
CREATE INDEX idx_payroll_obligations_client_id ON public.payroll_obligations(client_id);

-- Enable RLS
ALTER TABLE public.payroll_obligations ENABLE ROW LEVEL SECURITY;

-- Create open policies for now (adjust for production)
CREATE POLICY "Allow all access to payroll_obligations" 
ON public.payroll_obligations 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_payroll_obligations_updated_at
BEFORE UPDATE ON public.payroll_obligations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();