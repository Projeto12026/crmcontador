
-- Add employee-based pricing fields to service catalog
ALTER TABLE public.pricing_service_catalog
ADD COLUMN included_employees integer DEFAULT NULL,
ADD COLUMN additional_employee_value numeric DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.pricing_service_catalog.included_employees IS 'Number of employees included in the base price (e.g., 3)';
COMMENT ON COLUMN public.pricing_service_catalog.additional_employee_value IS 'Price per additional employee beyond included count (e.g., 50.00)';
