-- Drop the partial index that PostgREST doesn't recognize
DROP INDEX IF EXISTS idx_payroll_obligations_gclick_id_unique;

-- Add a proper UNIQUE constraint (PostgreSQL allows multiple NULLs in UNIQUE columns)
ALTER TABLE public.payroll_obligations ADD CONSTRAINT payroll_obligations_gclick_id_key UNIQUE (gclick_id);