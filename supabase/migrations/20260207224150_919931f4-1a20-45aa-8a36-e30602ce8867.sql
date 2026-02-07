
-- Remove existing check constraint on group_number and add a new one allowing 1-8 and 100
ALTER TABLE public.account_categories DROP CONSTRAINT IF EXISTS account_categories_group_number_check;
ALTER TABLE public.account_categories ADD CONSTRAINT account_categories_group_number_check CHECK (group_number >= 1);
