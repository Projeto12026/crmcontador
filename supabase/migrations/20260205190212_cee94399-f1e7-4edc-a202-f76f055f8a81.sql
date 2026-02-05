-- Add unique constraint on gclick_id for upsert to work
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_obligations_gclick_id 
ON public.payroll_obligations(gclick_id) 
WHERE gclick_id IS NOT NULL;